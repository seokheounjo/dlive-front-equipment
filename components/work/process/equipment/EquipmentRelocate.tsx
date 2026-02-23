/**
 * EquipmentRelocate Component
 * WRK_CD=07 (이전설치) 전용 장비정보 컴포넌트
 * 레거시 참조: mowoDivD05.xml, mowoa03m07.xml
 *
 * 주요 기능:
 * - 이전설치(07) 전용 컴포넌트
 * - 이전철거(08)에서 철거한 장비를 새 주소에 설치
 * - 모든 장비 철거/등록 가능
 * - 장비이관 + 분실처리 모두 가능
 * - 철거한 장비를 재사용하여 설치 가능
 * - 신호처리, 장비모델변경, 연동이력 기능
 */

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, CheckCircle2, XCircle, Loader2, RotateCcw, ScanBarcode, History } from 'lucide-react';
import { getTechnicianEquipments, updateEquipmentComposition, checkStbServerConnection, getEqtSoMoveInfo, getMVRemoveEqtInfo, RemovalEquipmentInfo } from '../../../../services/apiService';
import EquipmentModelChangeModal from './EquipmentModelChangeModal';
import IntegrationHistoryModal from '../../../modal/IntegrationHistoryModal';
import LdapQueryModal from '../../../modal/LdapQueryModal';
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
  mapWrkCdToCrrTskCl,
} from './shared/types';

const EquipmentRelocate: React.FC<EquipmentComponentProps> = ({
  workItem,
  onSave,
  onBack,
  showToast,
  preloadedApiData,
  onPreloadedDataUpdate,
  readOnly = false,
  isCertifyProd = false,
  certifyOpLnkdCd = '',
  onLdapConnect,
  isLdapDone = false,
  ldapLoading = false,
  ldapBlocked = false,
}) => {
  const isFtthProd = ['F', 'FG', 'Z', 'ZG'].includes(certifyOpLnkdCd);
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
  const [isLdapQueryModalOpen, setIsLdapQueryModalOpen] = useState(false);

  // 장비이관 모달 상태 (WRK_CD=07 전용)
  const [isEquipmentMoveModalOpen, setIsEquipmentMoveModalOpen] = useState(false);

  // 신호처리 팝업 상태
  const [isSignalPopupOpen, setIsSignalPopupOpen] = useState(false);
  const [isSignalProcessing, setIsSignalProcessing] = useState(false);

  // 바코드 스캔 상태
  const [isBarcodeScanning, setIsBarcodeScanning] = useState(false);
  // 새로고침 상태
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 하단 탭 상태 (철거장비/기사재고장비)
  const [bottomTab, setBottomTab] = useState<'removal' | 'stock'>('stock');

  // 이전철거 장비 목록 (getMVRemoveEqtInfo - 진입 시 조회)
  const [mvRemoveEquipments, setMvRemoveEquipments] = useState<RemovalEquipmentInfo[]>([]);

  // 이관된 장비 시리얼 넘버 (하이라이트 표시용) - API에서 가져온 이관 완료 장비
  const [transferredEquipmentSerials, setTransferredEquipmentSerials] = useState<Set<string>>(new Set());
  // 방금 이관한 장비 (깜빡임 애니메이션용)
  const [recentlyTransferredSerials, setRecentlyTransferredSerials] = useState<Set<string>>(new Set());

  // 철거장비 뱃지 카운트: getMVRemoveEqtInfo 결과 사용 (이관 완료 장비 제외)
  const removalBadgeCount = workItem.WRK_CD === '07' && customerEquipments.length === 0
    ? mvRemoveEquipments.filter(eq => !transferredEquipmentSerials.has(eq.EQT_SERNO || '')).length
    : 0;

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

  // removalBadgeCount는 store에서 자동 계산되므로 별도 useEffect 불필요

  // Zustand store가 자동으로 localStorage에 persist하므로 별도 저장 로직 불필요

  const loadEquipmentData = async (forceRefresh = false) => {
    try {
      let apiResponse;

      // WRKR_ID 디버그 로깅
      const userInfo = localStorage.getItem('userInfo');
      const user = userInfo ? JSON.parse(userInfo) : null;
      console.log('[장비관리-이전설치] WRKR_ID 디버그:', {
        'workItem.WRKR_ID': workItem.WRKR_ID,
        'user.userId': user?.userId,
        'user.workerId': user?.workerId,
        '최종 WRKR_ID': workItem.WRKR_ID || user?.userId || user?.workerId || '',
        forceRefresh,
      });

      // 이전설치(06/07) 작업은 반드시 계약장비(output2)가 있어야 함
      // preloadedApiData가 있어도 계약장비가 비어있으면 API 재호출
      const hasValidPreloadedData = preloadedApiData &&
        preloadedApiData.contractEquipments &&
        preloadedApiData.contractEquipments.length > 0;

      if (hasValidPreloadedData && !forceRefresh) {
        console.log('[장비관리-이전설치] Pre-loaded 데이터 사용 -', preloadedApiData.contractEquipments.length, '개 계약장비');
        console.log('[장비관리-이전설치] ⚠️ preloaded 데이터 사용 중 - 기사재고가 안 보이면 "장비 리프레시" 버튼 클릭하세요');
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
          WRKR_ID: workItem.WRKR_ID || user.userId || user.workerId || '',
          SO_ID: workItem.SO_ID || user.soId,
          WRK_ID: workItem.id,
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

      // 이전철거 장비 조회 (getMVRemoveEqtInfo - 레거시: mowoa03p10.xml OnLoadCompleted)
      const custId = workItem.customer?.id || workItem.CUST_ID || '';
      const rcptId = workItem.RCPT_ID || '';
      if (custId && rcptId) {
        try {
          const mvEqts = await getMVRemoveEqtInfo({ CUST_ID: custId, RCPT_ID: rcptId });
          console.log('[장비관리-이전설치] 이전철거 장비:', mvEqts.length, '건');
          setMvRemoveEquipments(mvEqts);
        } catch (err) {
          console.error('[장비관리-이전설치] 이전철거 장비 조회 실패:', err);
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
      const matchedContractIds = new Set<string>();
      const installed: InstalledEquipment[] = (apiResponse.customerEquipments || []).map((eq: any) => {
        const matchedContract = contracts.find(c =>
          c.itemMidCd === eq.ITEM_MID_CD && !matchedContractIds.has(c.id)
        );
        if (matchedContract) matchedContractIds.add(matchedContract.id);
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

      // WRK_CD=07 (이전설치): 이관 완료 장비 추적 (뱃지 카운트 차감용)
      if (workItem.WRK_CD === '07' && workItem.id) {
        getEqtSoMoveInfo({ WRK_ID: workItem.id }).then((moveInfoList: any[]) => {
          const transferredSerials = new Set(
            moveInfoList
              .filter((info: any) => info.SUCCESS_GUBN === 'SUCCESS')
              .map((info: any) => info.EQT_SERNO)
              .filter(Boolean)
          );
          if (transferredSerials.size > 0) {
            setTransferredEquipmentSerials(transferredSerials);
          }
        }).catch(() => {});
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

  // 계약 장비 카드 클릭
  const handleContractClick = (contract: ContractEquipment) => {
    const installed = installedEquipments.find(eq => eq.contractEquipment.id === contract.id);

    if (selectedContract?.id === contract.id) {
      // 토글: 같은 장비 두 번 클릭 시 선택 완전 해제
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

  // 등록 버튼 - 이전설치(07)은 모든 장비 등록 가능
  const handleRegisterEquipment = () => {
    if (!selectedContract || !selectedStock) return;

    // 모델명 검증: itemMidCd + model이 일치해야 함
    if (selectedContract.itemMidCd !== selectedStock.itemMidCd || selectedContract.model !== selectedStock.model) {
      showToast?.('계약장비 모델과 일치하지 않아 등록할 수 없습니다.', 'warning');
      return;
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
      };

  // 회수 버튼 - 이전설치(07)은 모든 장비 철거 가능
  const handleMarkForRemoval = () => {
    if (!selectedStock) return;

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
      setBottomTab('removal'); // 철거장비 탭으로 전환
      return;
    }

    const isAlreadyMarked = markedForRemoval.some(eq => eq.id === selectedStock.id);
    if (isAlreadyMarked) return;

    const isRemoveEquipment = removeEquipments.some(eq => eq.id === selectedStock.id);
    if (isRemoveEquipment) {
      addMarkedForRemoval(workId, selectedStock);
      setBottomTab('removal'); // 철거장비 탭으로 전환
    }
  };

  // 회수 장비를 설치 장비로 재사용
  const reuseRemovedEquipment = (removedEquipment: ExtendedEquipment) => {
    if (!selectedContract) {
      showToast?.('먼저 계약장비를 선택해주세요.', 'warning');
      return;
    }

    // 모델명 검증: itemMidCd + model이 일치해야 함
    if (selectedContract.itemMidCd !== removedEquipment.itemMidCd || selectedContract.model !== removedEquipment.model) {
      showToast?.('계약장비 모델과 일치하지 않아 등록할 수 없습니다.', 'warning');
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
          WRKR_ID: workItem.WRKR_ID || user.userId || user.workerId || '',
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
      showToast?.(error.message || '장비 모델 변경 중 오류가 발생했습니다.', 'error', true);
      throw error;
    }
  };

  // 신호처리
  const handleSignalProcess = async () => {

    if (installedEquipments.length === 0) {
      showToast?.('임시개통을 하려면 먼저 장비를 등록해주세요.', 'warning');
      storeSetSignalStatus(workId, 'fail');
      return;
    }

    try {
      setIsSignalProcessing(true);
      setIsSignalPopupOpen(true);
      storeSetSignalResult(workId, '임시개통 중...');

      const userInfo = localStorage.getItem('userInfo');
      if (!userInfo) {
        storeSetSignalResult(workId, '사용자 정보를 찾을 수 없습니다.');
        storeSetSignalStatus(workId, 'fail');
        setIsSignalProcessing(false);
        return;
      }

      const user = JSON.parse(userInfo);
      const regUid = user.userId || user.id || 'UNKNOWN';

      // 장비 타입 판단 함수 (콤보 상품 신호처리용)
      const isStb = (eq: any): boolean => {
        const eqtClCd = eq.actualEquipment?.eqtClCd || eq.eqtClCd || eq.actualEquipment?.EQT_CL_CD || '';
        const itemMidCd = eq.actualEquipment?.itemMidCd || eq.itemMidCd || eq.actualEquipment?.ITEM_MID_CD || '';
        const type = (eq.actualEquipment?.type || eq.type || '').toLowerCase();
        if (eqtClCd.startsWith('0904')) return true;
        if (itemMidCd === '02') return true;
        if (type.includes('stb') || type.includes('셋톱')) return true;
        return false;
      };

      const isModem = (eq: any): boolean => {
        const eqtClCd = eq.actualEquipment?.eqtClCd || eq.eqtClCd || eq.actualEquipment?.EQT_CL_CD || '';
        const itemMidCd = eq.actualEquipment?.itemMidCd || eq.itemMidCd || eq.actualEquipment?.ITEM_MID_CD || '';
        const type = (eq.actualEquipment?.type || eq.type || '').toLowerCase();
        if (eqtClCd.startsWith('0902')) return true;
        if (itemMidCd === '03') return true;
        if (type.includes('modem') || type.includes('모뎀')) return true;
        return false;
      };

      // STB, Modem 장비 찾기
      const stbEquipment = installedEquipments.find(isStb);
      const modemEquipment = installedEquipments.find(isModem);
      const stbEqtNo = stbEquipment?.actualEquipment?.id || '';
      const modemEqtNo = modemEquipment?.actualEquipment?.id || '';

      const result = await checkStbServerConnection(
        regUid,
        workItem.CTRT_ID || '',
        workItem.id,
        'SMR03',
        stbEqtNo || installedEquipments[0]?.actualEquipment?.id || '',
        modemEqtNo || ''
      );

      if (result.O_IFSVC_RESULT && result.O_IFSVC_RESULT.startsWith('TRUE')) {
        storeSetSignalResult(workId, `임시개통 완료\n\n결과: ${result.O_IFSVC_RESULT || '성공'}`);
        storeSetSignalStatus(workId, 'success');
      } else {
        storeSetSignalResult(workId, `임시개통 실패\n\n${result.MESSAGE || '알 수 없는 오류'}`);
        storeSetSignalStatus(workId, 'fail');
      }
    } catch (error: any) {
      storeSetSignalResult(workId, `임시개통 실패\n\n${error.message || '알 수 없는 오류'}`);
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

  // 인라인 분실/파손 체크박스 상태 변경 핸들러
  const handleRemovalStatusChange = (eqtNo: string, statusKey: string, currentValue: string) => {
    const newValue = currentValue === '1' ? '0' : '1';
    // setRemovalStatus는 (workId, eqtNo, field, value) 4개 파라미터 필요
    storeSetRemovalStatus(workId, eqtNo, statusKey, newValue);
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

  // 철거장비 탭에 표시할 장비 (등록된 장비 제외)
  const displayedRemovalEquipments = useMemo((): ExtendedEquipment[] => {
    const installedIds = new Set(installedEquipments.map(eq => eq.actualEquipment.id));

    // markedForRemoval + removeEquipments 합치고, 이미 등록된 장비 제외
    const combined = [
      ...markedForRemoval,
      ...removeEquipments.filter(eq => !installedIds.has(eq.id) && !markedForRemoval.some(m => m.id === eq.id))
    ];

    return combined;
  }, [markedForRemoval, removeEquipments, installedEquipments]);

  // 바코드 스캔
  const handleBarcodeScan = () => {
    setIsBarcodeScanning(true);
    setTimeout(() => {
      setIsBarcodeScanning(false);
      showToast?.('바코드 스캔 기능은 준비 중입니다.', 'info');
    }, 500);
  };

  // 장비 정보 새로고침
  const handleRefresh = async () => {
    if (isRefreshing || isWorkCompleted) return;

    setIsRefreshing(true);
    try {
      await loadEquipmentData(true);
      showToast?.('장비 정보를 새로고침했습니다.', 'success');
    } catch (error) {
      console.error('[장비관리-이전설치] 새로고침 실패:', error);
      showToast?.('장비 정보 새로고침에 실패했습니다.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4 bg-gray-50 pb-4">
      {/* 고객 설치 장비 섹션 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 relative">
        {/* 리프레시 로딩 오버레이 */}
        {isRefreshing && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
            <div className="flex flex-col items-center gap-2">
              <RotateCcw className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="text-sm text-gray-600 font-medium">장비 정보 로딩 중...</span>
            </div>
          </div>
        )}
        <div className="p-3 sm:p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm sm:text-base font-bold text-gray-900">
                고객 설치 장비
                {(workItem.productName || workItem.PROD_NM) && (
                  <span className="font-normal text-blue-600 ml-1">({workItem.productName || workItem.PROD_NM})</span>
                )}
              </h4>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || isWorkCompleted}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all text-xs font-medium ${
                  isRefreshing || isWorkCompleted
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-blue-500 hover:text-blue-600 hover:bg-blue-50 active:scale-95'
                }`}
                title="장비 정보 새로고침"
              >
                <RotateCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
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
            {/* 신호처리 / LDAP연동 버튼 */}
            {isCertifyProd ? (
              <button
                className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border-2 transition-all active:scale-95 min-h-[56px] ${
                  isLdapDone
                    ? 'border-green-300 bg-green-100 text-green-700'
                    : ldapLoading
                      ? 'border-yellow-300 bg-yellow-100 text-yellow-700'
                      : ldapBlocked
                        ? 'border-gray-300 bg-gray-100 text-gray-400'
                        : 'border-blue-300 bg-blue-100 text-blue-700 hover:bg-blue-200 hover:border-blue-400'
                }`}
                onClick={() => onLdapConnect?.()}
                disabled={ldapLoading || isWorkCompleted}
              >
                {ldapLoading ? (
                  <Loader2 className="w-5 h-5 mb-1 animate-spin" />
                ) : (
                  <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" />
                  </svg>
                )}
                <span className="text-xs font-semibold">{isLdapDone ? 'LDAP완료' : 'LDAP연동'}</span>
              </button>
            ) : (
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
                <span className="text-xs font-semibold">임시개통</span>
              </button>
            )}
            {/* 장비철거 버튼 - 장비이관 모달 */}
            <button
                className={`relative flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border-2 transition-all active:scale-95 min-h-[56px] ${
                  isWorkCompleted || customerEquipments.length > 0
                    ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                    : 'border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300'
                }`}
                onClick={() => !isWorkCompleted && customerEquipments.length === 0 && setIsEquipmentMoveModalOpen(true)}
                disabled={isWorkCompleted || customerEquipments.length > 0}
              >
                {/* 철거장비 개수 뱃지 - store의 removeEquipments에서 직접 계산 */}
                {removalBadgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full shadow-sm">
                    {removalBadgeCount}
                  </span>
                )}
                <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-xs font-semibold">장비철거</span>
              </button>
            {/* 연동이력 / LDAP조회 버튼 */}
            <button
              className="flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border-2 transition-all active:scale-95 min-h-[56px] border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 hover:border-purple-300"
              onClick={() => isCertifyProd ? setIsLdapQueryModalOpen(true) : setIsIntegrationHistoryModalOpen(true)}
            >
              <History className="w-5 h-5 mb-1" />
              <span className="text-xs font-semibold">{isCertifyProd ? 'LDAP조회' : '연동이력'}</span>
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
          <div className="py-8 text-center">
            <div className="text-sm text-gray-500 mb-2">계약 장비가 없습니다</div>
            <div className="text-xs text-gray-400">장비 추가가 필요하면 위의 [장비변경] 버튼을 눌러주세요</div>
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

      {/* 회수/등록 버튼 */}
      {!isWorkCompleted && (
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          {/* 회수 버튼 (↓) - 고객설치장비 또는 이전철거장비에서 선택한 장비를 철거장비로 */}
          <button
            className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 transition-all ${
              !selectedStock || !installedEquipments.some(eq => eq.actualEquipment.id === selectedStock?.id)
                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-red-500 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer active:scale-95'
            }`}
            onClick={handleMarkForRemoval}
            disabled={!selectedStock || !installedEquipments.some(eq => eq.actualEquipment.id === selectedStock?.id)}
          >
            <ArrowDown size={32} className="sm:w-10 sm:h-10" strokeWidth={2.5} />
          </button>
          {/* 등록 버튼 (↑) - 기사재고 또는 철거장비에서 선택한 장비를 고객 설치로 */}
          <button
            className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 transition-all ${
              !selectedStock || installedEquipments.some(eq => eq.actualEquipment.id === selectedStock?.id)
                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-blue-500 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer active:scale-95'
            }`}
            onClick={() => {
              if (!selectedStock) return;

              // 철거장비(markedForRemoval)에서 선택한 경우 -> 자동 계약장비 매칭 후 복원
              const isFromMarkedForRemoval = markedForRemoval.some(eq => eq.id === selectedStock.id);

              if (isFromMarkedForRemoval) {
                // 선택된 계약장비가 있으면 모델 검증
                if (selectedContract) {
                  if (selectedContract.itemMidCd !== selectedStock.itemMidCd || selectedContract.model !== selectedStock.model) {
                    showToast?.('계약장비 모델과 일치하지 않아 등록할 수 없습니다.', 'warning');
                    return;
                  }
                }

                // 일치하는 계약장비 찾기
                const matchedContract = selectedContract || contractEquipments.find(c =>
                  c.itemMidCd === selectedStock.itemMidCd && c.model === selectedStock.model
                );

                if (!matchedContract) {
                  showToast?.('일치하는 계약장비가 없습니다.', 'warning');
                  return;
                }

                // 해당 계약 슬롯에 이미 장비가 설치되어 있는지 확인 (어떤 장비든 먼저 회수 필요)
                const existingEquipment = installedEquipments.find(eq =>
                  eq.contractEquipment.id === matchedContract.id
                );
                if (existingEquipment) {
                  showToast?.('먼저 기존 장비를 회수해주세요.', 'warning');
                  return;
                }

                // installedEquipments에 추가
                const newInstalled: InstalledEquipment = {
                  contractEquipment: matchedContract,
                  actualEquipment: selectedStock,
                  macAddress: selectedStock.macAddress || '',
                };
                storeSetInstalledEquipments(workId, [...installedEquipments, newInstalled]);

                // markedForRemoval에서 제거
                removeMarkedForRemoval(workId, selectedStock.id);

                storeSetSelectedStock(workId, null);
                showToast?.('장비를 등록하였습니다.', 'success');
                return;
              }

              // 기사재고장비 또는 이전철거장비(removeEquipments)에서 선택한 경우 -> 계약장비 선택 필수
              if (!selectedContract) {
                showToast?.('상단에서 계약장비를 먼저 선택해주세요.', 'warning');
                return;
              }

              // 해당 계약 슬롯에 이미 장비가 등록되어 있으면 먼저 회수 필요 (어떤 장비든)
              const existingEquipmentInSlot = installedEquipments.find(eq =>
                eq.contractEquipment.id === selectedContract.id
              );
              if (existingEquipmentInSlot) {
                showToast?.('먼저 기존 장비를 회수해주세요.', 'warning');
                return;
              }

              // 기존 등록 로직
              handleRegisterEquipment();
            }}
            disabled={!selectedStock || installedEquipments.some(eq => eq.actualEquipment.id === selectedStock?.id)}
          >
            <ArrowUp size={32} className="sm:w-10 sm:h-10" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* 철거장비/기사재고장비 탭 섹션 */}
      {!isWorkCompleted && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 relative">
          {/* 리프레시 로딩 오버레이 */}
          {isRefreshing && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
              <div className="flex flex-col items-center gap-2">
                <RotateCcw className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="text-sm text-gray-600 font-medium">장비 정보 로딩 중...</span>
              </div>
            </div>
          )}
          {/* 탭 헤더 - 고객장비가 있을 때만 탭 표시, 없으면 기사재고장비만 */}
          {customerEquipments.length > 0 ? (
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
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                    bottomTab === 'removal' ? 'bg-orange-500 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    {displayedRemovalEquipments.length}
                  </span>
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
          ) : (
            /* 철거장비 없으면 기사재고장비 헤더만 표시 */
            <div className="py-3 px-4 border-b-2 border-blue-500">
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm font-semibold text-blue-600">기사재고장비</span>
                {selectedContract && availableStock.length > 0 && (
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-500 text-white">
                    {availableStock.length}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 탭 콘텐츠 */}
          {customerEquipments.length > 0 && bottomTab === 'removal' ? (
            /* 철거장비 탭 - 등록되지 않은 장비만 표시 */
            <div className="p-3 sm:p-4 space-y-3 max-h-80 overflow-y-auto">
              {displayedRemovalEquipments.map((equipment, idx) => {
                const eqtNo = equipment.id;
                const isSelected = selectedStock?.id === eqtNo;
                const isMarkedForRemoval = markedForRemoval.some(eq => eq.id === eqtNo);

                return (
                  <div
                    key={`removal-${eqtNo || idx}`}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : isMarkedForRemoval
                          ? 'border-red-200 bg-red-50 hover:border-red-300'
                          : 'border-orange-200 bg-orange-50 hover:border-orange-300'
                    }`}
                    onClick={() => handleStockClick(equipment)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                          isMarkedForRemoval ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                        }`}>
                          {isMarkedForRemoval ? '↓' : idx + 1}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{equipment.type}</div>
                          <div className="text-xs text-gray-600">{equipment.model}</div>
                          <div className="text-xs text-gray-500">S/N: {equipment.serialNumber}</div>
                          {equipment.macAddress && (
                            <div className="text-xs text-gray-500">MAC: {equipment.macAddress}</div>
                          )}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                        isMarkedForRemoval ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                      }`}>
                        {isMarkedForRemoval ? '회수' : '이전철거'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
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
                          <div className={`absolute -top-2 left-3 px-2 py-0.5 text-white text-[0.625rem] sm:text-xs font-bold rounded-full shadow-sm ${
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
            </>
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
            installedEquipmentCount={installedEquipments.length}
            customerEquipmentCount={customerEquipmentCount}
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

      <LdapQueryModal
        isOpen={isLdapQueryModalOpen}
        onClose={() => setIsLdapQueryModalOpen(false)}
        ctrtId={workItem.DTL_CTRT_ID || workItem.CTRT_ID}
      />

      {/* 장비이관 모달 - 장비이관 + 분실처리 (deferLossProcessing=true: 분실처리 API는 작업완료 시 호출) */}
      <EquipmentMoveModal
          isOpen={isEquipmentMoveModalOpen}
          onClose={() => {
            setIsEquipmentMoveModalOpen(false);
            // 모달 닫을 때 장비 데이터 리프레시 (뱃지 카운트는 loadEquipmentData 내부에서 즉시 설정)
            loadEquipmentData(true);
          }}
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
          deferLossProcessing={false}
          onSaveLossStatus={handleSaveLossStatus}
          alreadyProcessedSerials={transferredEquipmentSerials}
          onSuccess={(transferredSerials: string[]) => {
            // 이관/분실처리 성공 시 즉시 transferred 추가 → removalBadgeCount 자동 차감
            console.log('[EquipmentMoveRemoval] 장비처리 성공 - 처리된 장비:', transferredSerials);
            setTransferredEquipmentSerials(new Set([...transferredEquipmentSerials, ...transferredSerials]));
            setRecentlyTransferredSerials(new Set(transferredSerials));
            // 10초 후 하이라이트 제거
            setTimeout(() => {
              setRecentlyTransferredSerials(new Set());
            }, 10000);
          }}
        />

      {/* 신호처리 팝업 */}
      {isSignalPopupOpen && createPortal(
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4"
          onClick={() => !isSignalProcessing && setIsSignalPopupOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-lg max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">임시개통</h3>
            </div>

            <div className="px-6 py-8">
              {isSignalProcessing ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-blue-500">
                    <Loader2 className="animate-spin" size={64} />
                  </div>
                  <p className="text-base font-semibold text-gray-900">임시개통 중...</p>
                  <p className="text-sm text-gray-500">잠시만 기다려주세요</p>
                </div>
              ) : lastSignalStatus === 'success' ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-green-500">
                    <CheckCircle2 size={64} />
                  </div>
                  <p className="text-base font-semibold text-gray-900">임시개통 완료!</p>
                  <div className="w-full p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{signalResult}</pre>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-red-500">
                    <XCircle size={64} />
                  </div>
                  <p className="text-base font-semibold text-gray-900">임시개통 실패</p>
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
      , document.body)}
    </div>
  );
};

export default EquipmentRelocate;
