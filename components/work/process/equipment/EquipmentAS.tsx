/**
 * EquipmentAS Component
 * WRK_CD=03 (A/S) 작업 전용 장비정보 컴포넌트
 *
 * 상태 관리:
 * - Zustand (useWorkEquipmentStore): 클라이언트 상태 (설치 장비, 회수 장비, 신호처리 등)
 * - localStorage persist: Zustand middleware로 자동 저장
 *
 * A/S 작업 특징:
 * - 등록/회수/장비변경 모든 버튼 활성화
 * - CTRT_STAT=20(정상) 상태일 때만 철거 가능
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowUp, ArrowDown, CheckCircle2, XCircle, Loader2, ScanBarcode, History, AlertTriangle } from 'lucide-react';
import { getTechnicianEquipments, updateEquipmentComposition, checkStbServerConnection } from '../../../../services/apiService';
import EquipmentModelChangeModal from '../../../equipment/EquipmentModelChangeModal';
import IntegrationHistoryModal from '../../../modal/IntegrationHistoryModal';
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
  getEquipmentStorageKey,
} from './shared/types';

const EquipmentAS: React.FC<EquipmentComponentProps> = ({
  workItem,
  onSave,
  onBack,
  showToast,
  preloadedApiData,
  onPreloadedDataUpdate,
  readOnly = false,
}) => {
  const workId = workItem.id;

  // 작업 완료 여부 확인
  const isWorkCompleted = readOnly || workItem.WRK_STAT_CD === '4' || workItem.status === '완료';

  // Work Process Store (필터링 데이터 저장용 - 레거시 호환)
  const { setFilteringData } = useWorkProcessStore();

  // Work Equipment Store - Actions
  const {
    initWorkState,
    setApiData,
    setDataLoaded,
    addInstalledEquipment,
    removeInstalledEquipment,
    setInstalledEquipments: storeSetInstalledEquipments,
    clearInstalledEquipments,
    setSelectedContract: storeSetSelectedContract,
    setSelectedStock: storeSetSelectedStock,
    clearSelection,
    toggleRemovalStatus,
    addMarkedForRemoval,
    removeMarkedForRemoval,
    setMarkedForRemoval: storeSetMarkedForRemoval,
    setPendingLossStatusList: storeSetPendingLossStatusList,
    setSignalStatus,
    setSignalResult,
    setFullRemovalStatus,
  } = useWorkEquipmentStore();

  // Work Equipment Store - State (현재 작업)
  const {
    contractEquipments,
    technicianEquipments,
    removeEquipments,
    installedEquipments,
    removalStatus,
    markedForRemoval,
    pendingLossStatusList,
    selectedContract,
    selectedStock,
    signalStatus: lastSignalStatus,
    signalResult,
    filteringData,
    isReady: isDataLoaded,
  } = useWorkEquipment(workId);

  // API output4에서 받아온 고객장비 수 (서버에 이미 등록된 장비) - 로컬 UI 상태
  const [customerEquipmentCount, setCustomerEquipmentCount] = useState<number>(0);

  // 하단 탭 상태: 'removal' = 철거장비, 'stock' = 기사재고장비
  const [bottomTab, setBottomTab] = useState<'removal' | 'stock'>('removal');

  // 모달 상태 (로컬 UI 상태)
  const [isModelChangeModalOpen, setIsModelChangeModalOpen] = useState(false);
  const [isIntegrationHistoryModalOpen, setIsIntegrationHistoryModalOpen] = useState(false);
  const [isSignalPopupOpen, setIsSignalPopupOpen] = useState(false);
  const [isSignalProcessing, setIsSignalProcessing] = useState(false);
  const [isBarcodeScanning, setIsBarcodeScanning] = useState(false);

  // 초기화 및 데이터 로드
  useEffect(() => {
    // 이미 데이터가 로드된 상태면 건너뜀 (탭 이동 시 기존 데이터 유지)
    if (isDataLoaded && (installedEquipments.length > 0 || markedForRemoval.length > 0 || contractEquipments.length > 0)) {
      console.log('[장비관리-AS] 이미 데이터 로드됨 - 기존 데이터 유지');
      return;
    }
    initWorkState(workId);
    loadEquipmentData();
  }, [workItem.id]);

  // Zustand store가 자동으로 localStorage에 persist하므로 별도 저장 로직 불필요

  const loadEquipmentData = async (forceRefresh = false) => {
    try {
      let apiResponse;

      // A/S(03) 작업은 반드시 계약장비(output2)가 있어야 함
      // preloadedApiData가 있어도 계약장비가 비어있으면 API 재호출
      const hasValidPreloadedData = preloadedApiData &&
        preloadedApiData.contractEquipments &&
        preloadedApiData.contractEquipments.length > 0;

      if (hasValidPreloadedData && !forceRefresh) {
        console.log('[장비관리-AS] Pre-loaded 데이터 사용 -', preloadedApiData.contractEquipments.length, '개 계약장비');
        apiResponse = preloadedApiData;
      } else {
        if (forceRefresh) {
          console.log('[장비관리-AS] 강제 새로고침 - API 호출');
        } else if (preloadedApiData && (!preloadedApiData.contractEquipments || preloadedApiData.contractEquipments.length === 0)) {
          console.log('[장비관리-AS] preloadedApiData 계약장비 없음 - API 재호출');
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

        console.log('[장비관리-AS] API 호출:', requestPayload);
        apiResponse = await getTechnicianEquipments(requestPayload);

        if (forceRefresh && onPreloadedDataUpdate) {
          console.log('[장비관리-AS] 부모 컴포넌트 preloadedData 업데이트');
          onPreloadedDataUpdate(apiResponse);
        }
      }

      console.log('[장비관리-AS] API 응답:', {
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

      // output5: 회수 장비
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

      // setApiData를 사용하여 store에 데이터 저장
      setApiData(workId, {
        contractEquipments: contracts,
        technicianEquipments: techStock,
        removeEquipments: removed,
      });
      setCustomerEquipmentCount(installed.length);


      if (installed.length > 0) {
        // 이미 철거장비(markedForRemoval)에 있는 장비는 설치장비에서 제외
        // (장비변경 후 재조회 시 철거장비가 다시 설치장비로 들어가지 않도록)
        const currentMarkedIds = new Set(markedForRemoval.map(eq => eq.id));
        const filteredInstalled = installed.filter(eq => !currentMarkedIds.has(eq.actualEquipment.id));

        // 모델 불일치 고객장비 자동 철거 처리
        // (장비변경 후 계약장비 모델과 고객장비 모델이 다르면 UI에서 안 보이므로 자동 철거)
        const matchedInstalled: InstalledEquipment[] = [];
        const unmatchedEquipments: ExtendedEquipment[] = [];

        filteredInstalled.forEach(eq => {
          // 해당 고객장비와 같은 종류(itemMidCd)의 계약장비 찾기
          const matchingContract = contracts.find(c => c.itemMidCd === eq.actualEquipment.itemMidCd);

          // 계약장비가 있고 모델(eqtClCd)이 일치하면 설치장비에 유지
          if (matchingContract && matchingContract.eqtClCd === eq.actualEquipment.eqtClCd) {
            matchedInstalled.push(eq);
          } else {
            // 모델 불일치 또는 계약장비 없음 -> 철거장비로 이동
            unmatchedEquipments.push(eq.actualEquipment);
          }
        });

        // 모델 불일치 장비 철거장비에 추가
        if (unmatchedEquipments.length > 0) {
          const newMarkedForRemoval = [
            ...markedForRemoval,
            ...unmatchedEquipments.filter(eq => !markedForRemoval.some(m => m.id === eq.id))
          ];
          storeSetMarkedForRemoval(workId, newMarkedForRemoval);
          console.log('[장비관리-AS] 모델 불일치 고객장비 자동 철거:', unmatchedEquipments.length, '개');
        }

        console.log('[장비관리-AS] API에서 받은 고객 설치 장비:', installed.length, '개 → 모델 일치:', matchedInstalled.length, '개, 자동 철거:', unmatchedEquipments.length, '개');
        storeSetInstalledEquipments(workId, matchedInstalled);

        // localStorage에서 신호처리 상태와 철거 체크박스 상태 복원
        const savedDraft = localStorage.getItem(getEquipmentStorageKey(workItem.id));
        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            if (draftData.lastSignalStatus) {
              setSignalStatus(workId, draftData.lastSignalStatus);
            }
            if (draftData.removalStatus && Object.keys(draftData.removalStatus).length > 0) {
              setFullRemovalStatus(workId, draftData.removalStatus);
            }
            if (draftData.pendingLossStatusList && draftData.pendingLossStatusList.length > 0) {
              storeSetPendingLossStatusList(workId, draftData.pendingLossStatusList);
            }
          } catch (error) {
            // 무시
          }
        }
      } else {
        // localStorage에서 복원 시도
        const savedDraft = localStorage.getItem(getEquipmentStorageKey(workItem.id));
        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            if (draftData.installedEquipments && draftData.installedEquipments.length > 0) {
              console.log('[장비관리-AS] localStorage에서 장비 복원:', draftData.installedEquipments.length, '개');
              storeSetInstalledEquipments(workId, draftData.installedEquipments);
            }
            if (draftData.markedForRemoval && draftData.markedForRemoval.length > 0) {
              storeSetMarkedForRemoval(workId, draftData.markedForRemoval);
            }
            if (draftData.removalStatus && Object.keys(draftData.removalStatus).length > 0) {
              setFullRemovalStatus(workId, draftData.removalStatus);
            }
            if (draftData.pendingLossStatusList && draftData.pendingLossStatusList.length > 0) {
              storeSetPendingLossStatusList(workId, draftData.pendingLossStatusList);
            }
            if (draftData.lastSignalStatus) {
              setSignalStatus(workId, draftData.lastSignalStatus);
            }
          } catch (error) {
            console.warn('[장비관리-AS] localStorage 데이터 파싱 실패:', error);
          }
        }
      }

      // Use requestAnimationFrame to ensure state updates are applied before marking data as loaded
      requestAnimationFrame(() => setDataLoaded(workId, true));
    } catch (error) {
      console.error('[장비관리-AS] 장비 데이터 로드 실패:', error);
      requestAnimationFrame(() => setDataLoaded(workId, true));
    }
  };

  // 계약 장비 카드 클릭
  const handleContractClick = (contract: ContractEquipment) => {
    // 모델(eqtClCd)까지 일치해야 등록된 것으로 간주 (장비변경 시 모델 불일치 처리)
    const installed = installedEquipments.find(eq =>
      eq.contractEquipment.id === contract.id &&
      eq.actualEquipment.eqtClCd === contract.eqtClCd
    );

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
  const handleRegisterEquipment = () => {
    if (!selectedContract || !selectedStock) return;

    // A/S(03) 작업 시 계약상태 검증 (정상=20 상태만 등록 가능)
    // 레거시 mowoDivD05.xml line 451-455 참조
    const ctrtStat = workItem.CTRT_STAT;
    if (ctrtStat && ctrtStat !== '20') {
      const statusName = getContractStatusName(ctrtStat);
      showToast?.(`계약이 ${statusName} 상태이므로 장비교체를 등록하실 수 없습니다.`, 'error');
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

    setSignalStatus(workId, 'idle');
    storeSetSelectedStock(workId, null);
    storeSetSelectedContract(workId, null);
  };

  // 회수 버튼 (A/S 작업 전용 - CTRT_STAT=20 검증)
  const handleMarkForRemoval = () => {
    if (!selectedStock) return;

    // A/S(03) 작업 시 계약상태 검증 (정상=20 상태만 철거 가능)
    const ctrtStat = workItem.CTRT_STAT;
    if (ctrtStat && ctrtStat !== '20') {
      const statusName = getContractStatusName(ctrtStat);
      showToast?.(`계약이 ${statusName} 상태이므로 철거체크를 할 수 없습니다.`, 'error');
      return;
    }

    const installedIndex = installedEquipments.findIndex(eq => eq.actualEquipment.id === selectedStock.id);

    if (installedIndex >= 0) {
      const updated = [...installedEquipments];
      const removedEquipment = updated.splice(installedIndex, 1)[0];
      storeSetInstalledEquipments(workId, updated);

      const removedActualEquipment = removedEquipment.actualEquipment;
      const isAlreadyMarked = markedForRemoval.some(eq => eq.id === removedActualEquipment.id);
      if (!isAlreadyMarked) {
        storeSetMarkedForRemoval(workId, [...markedForRemoval, removedActualEquipment]);
      }

      setSignalStatus(workId, 'idle');
      storeSetSelectedStock(workId, null);
      storeSetSelectedContract(workId, null);
      return;
    }

    const isAlreadyMarked = markedForRemoval.some(eq => eq.id === selectedStock.id);
    if (isAlreadyMarked) return;

    const isRemoveEquipment = removeEquipments.some(eq => eq.id === selectedStock.id);
    if (isRemoveEquipment) {
      storeSetMarkedForRemoval(workId, [...markedForRemoval, selectedStock]);
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
    storeSetMarkedForRemoval(workId, markedForRemoval.filter(eq => eq.id !== removedEquipment.id));
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

        // 장비변경 시 기존 고객장비를 자동으로 철거장비로 이동
        // (기사재고에서 온 장비는 제외 - 그냥 등록 취소)
        const customerEquipmentsToRemove = installedEquipments.filter(eq =>
          !technicianEquipments.some(tech => tech.id === eq.actualEquipment.id)
        );

        if (customerEquipmentsToRemove.length > 0) {
          const equipmentsToMove = customerEquipmentsToRemove.map(eq => eq.actualEquipment);
          const newMarkedForRemoval = [
            ...markedForRemoval,
            ...equipmentsToMove.filter(eq => !markedForRemoval.some(m => m.id === eq.id))
          ];
          storeSetMarkedForRemoval(workId, newMarkedForRemoval);
          console.log('[장비변경] 기존 고객장비 철거장비로 이동:', equipmentsToMove.length, '개');
        }

        // 설치장비 목록 비우기 (새로 등록해야 함)
        clearInstalledEquipments(workId);

        // 장비변경 후 선택 상태 초기화 (이전 데이터가 남아있지 않도록)
        storeSetSelectedStock(workId, null);
        storeSetSelectedContract(workId, null);

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
      setSignalStatus(workId, 'fail');
      return;
    }

    try {
      setIsSignalProcessing(true);
      setIsSignalPopupOpen(true);
      setSignalResult(workId, '신호처리 중...');

      const userInfo = localStorage.getItem('userInfo');
      if (!userInfo) {
        setSignalResult(workId, '사용자 정보를 찾을 수 없습니다.');
        setSignalStatus(workId, 'fail');
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
        setSignalResult(workId, `신호처리 완료\n\n결과: ${result.O_IFSVC_RESULT || '성공'}`);
        setSignalStatus(workId, 'success');
      } else {
        setSignalResult(workId, `신호처리 실패\n\n${result.MESSAGE || '알 수 없는 오류'}`);
        setSignalStatus(workId, 'fail');
      }
    } catch (error: any) {
      setSignalResult(workId, `신호처리 실패\n\n${error.message || '알 수 없는 오류'}`);
      setSignalStatus(workId, 'fail');
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
      pendingLossStatusList: pendingLossStatusList, // 작업완료 시 분실처리 API 호출용
    };

    console.log('[장비관리-AS] 저장 데이터:', {
      설치장비: equipments.length,
      회수장비: removals.length,
    });

    onSave(data);
  };

  // 철거 장비 분실/파손 상태 토글
  const handleRemovalStatusChange = (eqtNo: string, field: string, value: string) => {
    const newStatus = {
      ...removalStatus,
      [eqtNo]: {
        ...(removalStatus[eqtNo] || {}),
        [field]: value === '1' ? '0' : '1'
      }
    };
    setFullRemovalStatus(workId, newStatus);
  };

  // 분실 상태 저장 핸들러 (작업완료 시 API 호출용)
  const handleSaveLossStatus = (lossStatusList: LossStatusData[]) => {
    console.log('[장비관리-AS] 분실 상태 저장:', lossStatusList.length, '건');
    // 기존 목록에서 같은 EQT_SERNO 장비는 제거하고 새로 추가
    const existingSerNos = new Set(lossStatusList.map(l => l.EQT_SERNO));
    const filtered = pendingLossStatusList.filter(p => !existingSerNos.has(p.EQT_SERNO));
    storeSetPendingLossStatusList(workId, [...filtered, ...lossStatusList]);
  };

  // 기사 재고 필터링
  const getAvailableStock = (): ExtendedEquipment[] => {
    const usedStockIds = new Set(installedEquipments.map(eq => eq.actualEquipment.id));
    let available = technicianEquipments.filter(stock => !usedStockIds.has(stock.id));

    if (selectedContract) {
      available = available.filter(stock =>
        stock.itemMidCd === selectedContract.itemMidCd &&
        stock.model === selectedContract.model
      );
    }

    return available;
  };

  // 회수 장비 중 재사용 가능한 장비
  const getReusableRemovedEquipments = (): ExtendedEquipment[] => {
    const usedStockIds = new Set(installedEquipments.map(eq => eq.actualEquipment.id));
    let reusable = markedForRemoval.filter(eq => !usedStockIds.has(eq.id));

    if (selectedContract) {
      reusable = reusable.filter(eq =>
        eq.itemMidCd === selectedContract.itemMidCd &&
        eq.model === selectedContract.model
      );
    }

    return reusable;
  };

  // 바코드 스캔
  const handleBarcodeScan = () => {
    setIsBarcodeScanning(true);
    setTimeout(() => {
      setIsBarcodeScanning(false);
      showToast?.('바코드 스캔 기능은 준비 중입니다.', 'info');
    }, 500);
  };

  const availableStock = getAvailableStock();
  const reusableEquipments = getReusableRemovedEquipments();

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4 bg-gray-50 pb-4">
      {/* 고객 설치 장비 섹션 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-3 sm:p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm sm:text-base font-bold text-gray-900">고객 설치 장비</h4>
            <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-gray-100 text-gray-700 text-xs sm:text-sm font-semibold rounded-full">{contractEquipments.length}개</span>
          </div>
          {/* 버튼 그룹 - 모바일에서 3열 그리드 */}
          <div className="grid grid-cols-3 gap-2">
            {/* 장비변경 버튼 */}
            <button
              className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border-2 transition-all active:scale-95 min-h-[56px] ${
                isWorkCompleted
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300'
              }`}
              onClick={() => {
                if (isWorkCompleted) return;
                const ctrtStat = workItem.CTRT_STAT;
                if (ctrtStat && ctrtStat !== '20') {
                  showToast?.('A/S 작업완료는 계약상태가 정상상태(20)일 경우만 장비구성 변경가능합니다.', 'warning');
                  return;
                }
                setIsModelChangeModalOpen(true);
              }}
              disabled={isWorkCompleted}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span className="text-xs font-semibold">장비변경</span>
            </button>
            {/* 신호처리 버튼 */}
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
            {/* 연동이력 버튼 */}
            <button
              className="flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border-2 border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 hover:border-purple-300 transition-all active:scale-95 min-h-[56px]"
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
              // 모델(eqtClCd)까지 일치해야 등록된 것으로 간주 (장비변경 시 모델 불일치 처리)
              const installed = installedEquipments.find(eq =>
                eq.contractEquipment.id === equipment.id &&
                eq.actualEquipment.eqtClCd === equipment.eqtClCd
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

                    {installed && (() => {
                      const isFromTechStock = technicianEquipments.some(eq => eq.id === installed.actualEquipment.id);
                      return (
                        <div className="pt-2.5 border-t border-gray-200 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-green-700 font-medium">✓ 등록: {installed.actualEquipment.model}</div>
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                              isFromTechStock
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {isFromTechStock ? '기사장비' : '고객장비'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">S/N: {installed.actualEquipment.serialNumber}</div>
                          {installed.macAddress && (
                            <div className="text-sm text-gray-600">MAC: {installed.macAddress}</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 등록/회수 화살표 버튼 */}
      {!isWorkCompleted && (
        <div className="flex items-center justify-center gap-4">
          {/* 등록 버튼 (↑) - 기사재고 또는 철거장비에서 선택한 장비를 고객 설치로 */}
          <button
            className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 transition-all ${
              !selectedStock || installedEquipments.some(eq => eq.actualEquipment.id === selectedStock?.id)
                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-blue-500 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer active:scale-95'
            }`}
            onClick={() => {
              if (!selectedStock) return;

              // 철거장비에서 선택한 경우 -> 다시 고객 설치로 복원
              const isFromMarkedForRemoval = markedForRemoval.some(eq => eq.id === selectedStock.id);
              if (isFromMarkedForRemoval) {
                // 해당 장비의 계약 정보 찾기 (모델까지 일치해야 등록 가능)
                const matchedContract = contractEquipments.find(c =>
                  c.itemMidCd === selectedStock.itemMidCd && c.eqtClCd === selectedStock.eqtClCd
                );

                if (!matchedContract) {
                  showToast?.('계약장비 모델과 일치하지 않아 등록할 수 없습니다. 장비변경 후 등록해주세요.', 'warning');
                  return;
                }

                // 해당 계약 슬롯에 이미 고객장비가 설치되어 있는지 확인 (기사장비는 제외 - 자유롭게 교체 가능)
                const existingCustomerEquipment = installedEquipments.find(eq =>
                  eq.contractEquipment.id === matchedContract.id &&
                  !technicianEquipments.some(tech => tech.id === eq.actualEquipment.id)
                );
                if (existingCustomerEquipment) {
                  showToast?.('먼저 기존 장비를 회수해주세요.', 'warning');
                  return;
                }

                if (matchedContract) {
                  // 다시 고객 설치 장비로 복원
                  const newInstalled = {
                    contractEquipment: matchedContract,
                    actualEquipment: selectedStock,
                    macAddress: selectedStock.macAddress,
                  };
                  const updatedInstalled = [...installedEquipments, newInstalled];
                  const updatedMarkedForRemoval = markedForRemoval.filter(eq => eq.id !== selectedStock.id);
                  storeSetInstalledEquipments(workId, updatedInstalled);
                  // 철거장비에서 제거
                  storeSetMarkedForRemoval(workId, updatedMarkedForRemoval);
                  // 분실 상태도 초기화
                  const newRemovalStatus = { ...removalStatus };
                  delete newRemovalStatus[selectedStock.id];
                  setFullRemovalStatus(workId, newRemovalStatus);
                  storeSetSelectedStock(workId, null);

                  // 콘솔 로그: 작업완료 시 넘어갈 데이터
                  console.log('=== [장비등록-복원] 작업완료 시 전송될 데이터 ===');
                  console.log('설치장비:', updatedInstalled.map(eq => ({
                    type: eq.actualEquipment.type,
                    model: eq.actualEquipment.model,
                    serialNumber: eq.actualEquipment.serialNumber,
                    id: eq.actualEquipment.id,
                  })));
                  console.log('철거장비:', updatedMarkedForRemoval.map(eq => ({
                    type: eq.type,
                    model: eq.model,
                    serialNumber: eq.serialNumber,
                    id: eq.id,
                    removalStatus: newRemovalStatus[eq.id] || {},
                  })));

                  showToast?.('장비가 고객 설치로 복원되었습니다.', 'success');
                } else {
                  showToast?.('매칭되는 계약장비를 찾을 수 없습니다.', 'error');
                }
                return;
              }

              // 기사재고에서 선택한 경우 -> 기존 등록 로직
              if (!selectedContract) {
                showToast?.('상단에서 계약장비를 먼저 선택해주세요.', 'warning');
                return;
              }
              // 고객장비 철거 전에는 기사재고 등록 불가 체크
              // 단, 선택한 계약장비와 같은 종류(itemMidCd)의 고객장비가 있을 때만 체크
              // (기사재고에서 등록한 장비는 제외)
              const matchingCustomerEquipment = installedEquipments.find(eq =>
                eq.contractEquipment.itemMidCd === selectedContract.itemMidCd &&
                !technicianEquipments.some(tech => tech.id === eq.actualEquipment.id)
              );
              const isMatchingEquipmentRemoved = matchingCustomerEquipment &&
                markedForRemoval.some(m => m.id === matchingCustomerEquipment.actualEquipment.id);

              if (matchingCustomerEquipment && !isMatchingEquipmentRemoved) {
                showToast?.('먼저 기존 장비를 회수해주세요.', 'warning');
                return;
              }

              // 새로 등록될 장비 데이터 미리 계산
              const newInstalled = {
                contractEquipment: selectedContract,
                actualEquipment: selectedStock,
                macAddress: selectedStock.macAddress || '',
              };
              const existingIndex = installedEquipments.findIndex(eq => eq.contractEquipment.id === selectedContract.id);
              let updatedInstalled;
              if (existingIndex >= 0) {
                updatedInstalled = [...installedEquipments];
                updatedInstalled[existingIndex] = newInstalled;
              } else {
                updatedInstalled = [...installedEquipments, newInstalled];
              }

              // 콘솔 로그: 작업완료 시 넘어갈 데이터
              console.log('=== [장비등록-기사재고] 작업완료 시 전송될 데이터 ===');
              console.log('설치장비:', updatedInstalled.map(eq => ({
                type: eq.actualEquipment.type,
                model: eq.actualEquipment.model,
                serialNumber: eq.actualEquipment.serialNumber,
                id: eq.actualEquipment.id,
              })));
              console.log('철거장비:', markedForRemoval.map(eq => ({
                type: eq.type,
                model: eq.model,
                serialNumber: eq.serialNumber,
                id: eq.id,
                removalStatus: removalStatus[eq.id] || {},
              })));

              handleRegisterEquipment();
            }}
            disabled={!selectedStock || installedEquipments.some(eq => eq.actualEquipment.id === selectedStock?.id)}
          >
            <ArrowUp size={32} className="sm:w-10 sm:h-10" strokeWidth={2.5} />
          </button>
          {/* 회수 버튼 (↓) - 고객 설치 장비를 철거장비로 또는 기사재고로 */}
          <button
            className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 transition-all ${
              !selectedStock || !installedEquipments.some(eq => eq.actualEquipment.id === selectedStock?.id)
                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-orange-500 bg-orange-50 text-orange-600 hover:bg-orange-100 cursor-pointer active:scale-95'
            }`}
            onClick={() => {
              if (!selectedStock) return;
              // 기사재고에서 등록한 장비인지 체크 (설치 준비중)
              const isFromTechStock = technicianEquipments.some(eq => eq.id === selectedStock.id);

              if (isFromTechStock) {
                // 기사재고장비 탭에서만 회수 가능 (등록 취소)
                if (bottomTab !== 'stock') {
                  showToast?.('설치 준비중인 장비입니다. 기사재고장비 탭에서 회수해주세요.', 'warning');
                  return;
                }
                // 등록 취소: installedEquipments에서만 제거 (markedForRemoval에 추가 안함)
                const installedIndex = installedEquipments.findIndex(eq => eq.actualEquipment.id === selectedStock.id);
                if (installedIndex >= 0) {
                  const updated = [...installedEquipments];
                  updated.splice(installedIndex, 1);
                  storeSetInstalledEquipments(workId, updated);
                  storeSetSelectedStock(workId, null);
                  storeSetSelectedContract(workId, null);

                  // 콘솔 로그: 작업완료 시 넘어갈 데이터
                  console.log('=== [장비회수-등록취소] 작업완료 시 전송될 데이터 ===');
                  console.log('설치장비:', updated.map(eq => ({
                    type: eq.actualEquipment.type,
                    model: eq.actualEquipment.model,
                    serialNumber: eq.actualEquipment.serialNumber,
                    id: eq.actualEquipment.id,
                  })));
                  console.log('철거장비:', markedForRemoval.map(eq => ({
                    type: eq.type,
                    model: eq.model,
                    serialNumber: eq.serialNumber,
                    id: eq.id,
                    removalStatus: removalStatus[eq.id] || {},
                  })));

                  showToast?.('장비 등록이 취소되었습니다.', 'success');
                }
                return;
              }

              // 고객 장비 회수: 새 상태 미리 계산
              const installedIndex = installedEquipments.findIndex(eq => eq.actualEquipment.id === selectedStock.id);
              let updatedInstalledForRemoval = [...installedEquipments];
              let updatedMarkedForRemoval = [...markedForRemoval];

              if (installedIndex >= 0) {
                const removedEquipment = updatedInstalledForRemoval.splice(installedIndex, 1)[0];
                const removedActualEquipment = removedEquipment.actualEquipment;
                const isAlreadyMarked = updatedMarkedForRemoval.some(eq => eq.id === removedActualEquipment.id);
                if (!isAlreadyMarked) {
                  updatedMarkedForRemoval = [...updatedMarkedForRemoval, removedActualEquipment];
                }
              }

              // 콘솔 로그: 작업완료 시 넘어갈 데이터
              console.log('=== [장비회수-고객장비] 작업완료 시 전송될 데이터 ===');
              console.log('설치장비:', updatedInstalledForRemoval.map(eq => ({
                type: eq.actualEquipment.type,
                model: eq.actualEquipment.model,
                serialNumber: eq.actualEquipment.serialNumber,
                id: eq.actualEquipment.id,
              })));
              console.log('철거장비:', updatedMarkedForRemoval.map(eq => ({
                type: eq.type,
                model: eq.model,
                serialNumber: eq.serialNumber,
                id: eq.id,
                removalStatus: removalStatus[eq.id] || {},
              })));

              // 실제 회수 처리
              handleMarkForRemoval();
              setBottomTab('removal'); // 철거장비 탭으로 전환
            }}
            disabled={!selectedStock || !installedEquipments.some(eq => eq.actualEquipment.id === selectedStock?.id)}
          >
            <ArrowDown size={32} className="sm:w-10 sm:h-10" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* 철거장비/기사재고장비 탭 섹션 */}
      {!isWorkCompleted && (
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
            /* 철거장비 탭 - 회수된 장비 목록 (인라인 분실처리) */
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

export default EquipmentAS;
