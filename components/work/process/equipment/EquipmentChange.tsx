/**
 * EquipmentChange Component
 * WRK_CD=05 (상품변경) 전용 장비정보 컴포넌트
 * 레거시 참조: mowoDivD05.xml, mowoa03m05.xml
 *
 * 주요 특징:
 * - 등록/회수/장비변경 모든 버튼 활성화
 * - DTL_CTRT_ID 사용 (CTRT_ID 대신)
 * - CHG_RESN_CD=H08(저ARPU) 일 때 BAR_CD 필터링 로직 (현재는 기본 로직만 구현)
 */

import React, { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, XCircle, Loader2, RotateCcw, ScanBarcode, History } from 'lucide-react';
import { getTechnicianEquipments, updateEquipmentComposition, checkStbServerConnection } from '../../../../services/apiService';
import EquipmentModelChangeModal from '../../../equipment/EquipmentModelChangeModal';
import IntegrationHistoryModal from '../../../modal/IntegrationHistoryModal';
import { useWorkProcessStore } from '../../../../stores/workProcessStore';
import {
  EquipmentComponentProps,
  ExtendedEquipment,
  ContractEquipment,
  InstalledEquipment,
  EquipmentData,
  RemovalStatus,
  getWorkCodeName,
  getContractStatusName,
  mapWrkCdToCrrTskCl,
  isCustomerOwnedEquipment,
  getEquipmentStorageKey,
} from './shared/types';

const EquipmentChange: React.FC<EquipmentComponentProps> = ({
  workItem,
  onSave,
  onBack,
  showToast,
  preloadedApiData,
  onPreloadedDataUpdate,
  readOnly = false,
}) => {
  // Work completion check
  const isWorkCompleted = readOnly || workItem.WRK_STAT_CD === '4' || workItem.status === '완료';

  // Work Process Store (for filtering data)
  const { setFilteringData } = useWorkProcessStore();

  // Contract equipment (top cards)
  const [contractEquipments, setContractEquipments] = useState<ContractEquipment[]>([]);
  // Technician stock equipment
  const [technicianEquipments, setTechnicianEquipments] = useState<ExtendedEquipment[]>([]);
  // Customer installed equipment (registered results)
  const [installedEquipments, setInstalledEquipments] = useState<InstalledEquipment[]>([]);
  // Customer equipment count from API output4 (already registered)
  const [customerEquipmentCount, setCustomerEquipmentCount] = useState<number>(0);
  // Equipment to be removed from customer
  const [removeEquipments, setRemoveEquipments] = useState<ExtendedEquipment[]>([]);
  // Equipment marked for removal
  const [markedForRemoval, setMarkedForRemoval] = useState<ExtendedEquipment[]>([]);

  // Removal equipment loss/damage status
  const [removalStatus, setRemovalStatus] = useState<RemovalStatus>({});

  // Initial data load completion flag
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Currently selected contract equipment
  const [selectedContract, setSelectedContract] = useState<ContractEquipment | null>(null);

  // Selected stock equipment
  const [selectedStock, setSelectedStock] = useState<ExtendedEquipment | null>(null);

  // Equipment model change modal state
  const [isModelChangeModalOpen, setIsModelChangeModalOpen] = useState(false);

  // Integration history modal state
  const [isIntegrationHistoryModalOpen, setIsIntegrationHistoryModalOpen] = useState(false);

  // Signal processing popup state
  const [isSignalPopupOpen, setIsSignalPopupOpen] = useState(false);
  const [signalResult, setSignalResult] = useState<string>('');
  const [isSignalProcessing, setIsSignalProcessing] = useState(false);
  const [lastSignalStatus, setLastSignalStatus] = useState<'success' | 'fail' | null>(null);

  // Barcode scan state
  const [isBarcodeScanning, setIsBarcodeScanning] = useState(false);

  // Initial data load
  useEffect(() => {
    setIsDataLoaded(false);
    loadEquipmentData();
  }, [workItem]);

  // Auto-save work in progress to localStorage
  useEffect(() => {
    if (!isDataLoaded) {
      return;
    }

    const storageKey = getEquipmentStorageKey(workItem.id);
    const hasRemovalStatus = Object.keys(removalStatus).length > 0;

    if (installedEquipments.length > 0 || markedForRemoval.length > 0 || hasRemovalStatus) {
      const draftData = {
        installedEquipments: installedEquipments,
        markedForRemoval: markedForRemoval,
        removalStatus: removalStatus,
        lastSignalStatus: lastSignalStatus,
        savedAt: new Date().toISOString(),
        kpiProdGrpCd: (window as any).__equipmentFilterData?.kpiProdGrpCd,
        prodChgGb: (window as any).__equipmentFilterData?.prodChgGb,
        chgKpiProdGrpCd: (window as any).__equipmentFilterData?.chgKpiProdGrpCd,
        prodGrp: (window as any).__equipmentFilterData?.prodGrp,
      };
      localStorage.setItem(storageKey, JSON.stringify(draftData));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [installedEquipments, markedForRemoval, removalStatus, isDataLoaded, lastSignalStatus]);

  const loadEquipmentData = async (forceRefresh = false) => {
    try {
      let apiResponse;

      if (preloadedApiData && !forceRefresh) {
        apiResponse = preloadedApiData;
      } else {
        if (forceRefresh) {
          console.log('[Equipment-ProductChange] Force refresh - calling API');
        }

        const userInfo = localStorage.getItem('userInfo');
        if (!userInfo) {
          console.error('User info not found');
          return;
        }

        const user = JSON.parse(userInfo);
        const crrTskCl = mapWrkCdToCrrTskCl(workItem.WRK_CD);

        // 상품변경(05) 작업은 DTL_CTRT_ID를 CTRT_ID로 사용
        const ctrtIdForProductChange = workItem.DTL_CTRT_ID || workItem.CTRT_ID;

        const requestPayload = {
          WRKR_ID: user.workerId || 'A20130708',
          SO_ID: workItem.SO_ID || user.soId,
          WORK_ID: workItem.id,
          CUST_ID: workItem.customer?.id || workItem.CUST_ID,
          RCPT_ID: workItem.RCPT_ID || null,
          CTRT_ID: ctrtIdForProductChange,
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

        console.log('[Equipment-ProductChange] API call (DTL_CTRT_ID 사용):', requestPayload);
        apiResponse = await getTechnicianEquipments(requestPayload);

        if (forceRefresh && onPreloadedDataUpdate) {
          console.log('[Equipment-ProductChange] Updating parent preloadedData');
          onPreloadedDataUpdate(apiResponse);
        }
      }

      console.log('[Equipment-ProductChange] API response:', {
        contractEquipments: apiResponse.contractEquipments?.length || 0,
        technicianEquipments: apiResponse.technicianEquipments?.length || 0,
        customerEquipments: apiResponse.customerEquipments?.length || 0,
        removedEquipments: apiResponse.removedEquipments?.length || 0,
      });

      // Save filtering data to Zustand Store
      const filterData = {
        kpiProdGrpCd: apiResponse.kpiProdGrpCd,
        prodChgGb: apiResponse.prodChgGb,
        chgKpiProdGrpCd: apiResponse.chgKpiProdGrpCd,
        prodGrp: apiResponse.prodGrp,
      };
      setFilteringData(filterData);
      (window as any).__equipmentFilterData = filterData;

      // output2: Contract equipment
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
      // 레거시 참조: CHG_RESN_CD=H08(저ARPU) 일 때 ITEM_MID_CD=04(STB)는 BAR_CD 필터링
      // 현재는 기본 로직만 구현 (향후 확장 가능)
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
        BAR_CD: eq.BAR_CD,
        CHG_RESN_CD: eq.CHG_RESN_CD,
      }));

      // output4: Customer installed equipment
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

      // output5: Equipment to be removed
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

      setContractEquipments(contracts);
      setTechnicianEquipments(techStock);
      setRemoveEquipments(removed);
      setCustomerEquipmentCount(installed.length);

      console.log('[Equipment-ProductChange] ====== Equipment Initialization Started ======');

      if (installed.length > 0) {
        console.log('[Equipment-ProductChange] Using customer equipment from API:', installed.length, 'items');
        setInstalledEquipments(installed);

        // Restore signal status and removal checkboxes from localStorage
        const savedDraft = localStorage.getItem(getEquipmentStorageKey(workItem.id));
        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            if (draftData.lastSignalStatus) {
              setLastSignalStatus(draftData.lastSignalStatus);
            }
            if (draftData.removalStatus && Object.keys(draftData.removalStatus).length > 0) {
              setRemovalStatus(draftData.removalStatus);
            }
          } catch (error) {
            // Ignore
          }
        }
      } else {
        // Try to restore from localStorage
        const savedDraft = localStorage.getItem(getEquipmentStorageKey(workItem.id));
        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            if (draftData.installedEquipments && draftData.installedEquipments.length > 0) {
              setInstalledEquipments(draftData.installedEquipments);
            }
            if (draftData.markedForRemoval && draftData.markedForRemoval.length > 0) {
              setMarkedForRemoval(draftData.markedForRemoval);
            }
            if (draftData.removalStatus && Object.keys(draftData.removalStatus).length > 0) {
              setRemovalStatus(draftData.removalStatus);
            }
            if (draftData.lastSignalStatus) {
              setLastSignalStatus(draftData.lastSignalStatus);
            }
          } catch (error) {
            console.warn('[Equipment-ProductChange] Failed to parse localStorage data:', error);
          }
        }
      }

      console.log('[Equipment-ProductChange] ====== Equipment Initialization Complete ======');
      setIsDataLoaded(true);
    } catch (error) {
      console.error('[Equipment-ProductChange] Failed to load equipment data:', error);
      setIsDataLoaded(true);
    }
  };

  // Contract equipment card click
  const handleContractClick = (contract: ContractEquipment) => {
    const installed = installedEquipments.find(eq => eq.contractEquipment.id === contract.id);

    if (selectedContract?.id === contract.id) {
      setSelectedContract(null);
      setSelectedStock(null);
    } else {
      setSelectedContract(contract);
      if (installed) {
        setSelectedStock(installed.actualEquipment);
      } else {
        setSelectedStock(null);
      }
    }
  };

  // Stock equipment click
  const handleStockClick = (stock: ExtendedEquipment) => {
    if (selectedStock?.id === stock.id) {
      setSelectedStock(null);
    } else {
      setSelectedStock(stock);
    }
  };

  // Register button
  const handleRegisterEquipment = () => {
    if (!selectedContract || !selectedStock) return;

    console.log('[Equipment-ProductChange] Registering equipment:', {
      contractEquipment: selectedContract.type,
      stockEquipment: `${selectedStock.type} (S/N: ${selectedStock.serialNumber})`
    });

    const existingIndex = installedEquipments.findIndex(eq => eq.contractEquipment.id === selectedContract.id);

    if (existingIndex >= 0) {
      const updated = [...installedEquipments];
      updated[existingIndex] = {
        contractEquipment: selectedContract,
        actualEquipment: selectedStock,
        macAddress: selectedStock.macAddress || '',
        installLocation: '',
      };
      setInstalledEquipments(updated);
    } else {
      const newInstalled: InstalledEquipment = {
        contractEquipment: selectedContract,
        actualEquipment: selectedStock,
        macAddress: selectedStock.macAddress || '',
        installLocation: '',
      };
      setInstalledEquipments([...installedEquipments, newInstalled]);
    }

    setLastSignalStatus(null);
    setSelectedStock(null);
    setSelectedContract(null);
  };

  // Remove button
  const handleMarkForRemoval = () => {
    if (!selectedStock) return;

    const installedIndex = installedEquipments.findIndex(eq => eq.actualEquipment.id === selectedStock.id);

    if (installedIndex >= 0) {
      const updated = [...installedEquipments];
      const removedEquipment = updated.splice(installedIndex, 1)[0];
      setInstalledEquipments(updated);

      const removedActualEquipment = removedEquipment.actualEquipment;
      const isAlreadyMarked = markedForRemoval.some(eq => eq.id === removedActualEquipment.id);
      if (!isAlreadyMarked) {
        setMarkedForRemoval(prev => [...prev, removedActualEquipment]);
      }

      setLastSignalStatus(null);
      setSelectedStock(null);
      setSelectedContract(null);
      return;
    }

    const isAlreadyMarked = markedForRemoval.some(eq => eq.id === selectedStock.id);
    if (isAlreadyMarked) return;

    const isRemoveEquipment = removeEquipments.some(eq => eq.id === selectedStock.id);
    if (isRemoveEquipment) {
      setMarkedForRemoval([...markedForRemoval, selectedStock]);
    }
  };

  // Reuse removed equipment for installation
  const reuseRemovedEquipment = (removedEquipment: ExtendedEquipment) => {
    if (!selectedContract) {
      showToast?.('Please select a contract equipment first', 'warning');
      return;
    }

    const newInstalled: InstalledEquipment = {
      contractEquipment: selectedContract,
      actualEquipment: {
        ...removedEquipment,
        EQT_CHG_GB: '3', // Reuse
      },
      macAddress: removedEquipment.macAddress,
    };

    setInstalledEquipments([...installedEquipments, newInstalled]);
    setMarkedForRemoval(markedForRemoval.filter(eq => eq.id !== removedEquipment.id));
    setSelectedContract(null);

    showToast?.('Removed equipment has been reused', 'success');
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

      // 상품변경(05) 작업은 DTL_CTRT_ID 사용
      const ctrtIdForProductChange = workItem.DTL_CTRT_ID || workItem.CTRT_ID;

      const equipments = selectedEquipmentsFromModal.map((eq: any, idx: number) => {
        let itemMidCd: string = eq.ITEM_MID_CD || eq.ITM_MID_CD || eq.EQT || eq.EQT_CD || '';
        let modelCode: string = eq.EQT_CL || eq.EQT_CL_CD || '';
        let svcCmpsId: string = eq.SVC_CMPS_ID || eq.PROD_CMPS_ID || eq.SVC_CMPS_SEQ || eq.EQUIP_SEQ || '';

        itemMidCd = String(itemMidCd).trim().padStart(2, '0');
        modelCode = String(modelCode).trim().padStart(6, '0');
        svcCmpsId = String(svcCmpsId || (idx + 1));

        return {
          CTRT_ID: ctrtIdForProductChange,
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
        CTRT_ID: ctrtIdForProductChange,
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
      setLastSignalStatus('fail');
      return;
    }

    try {
      setIsSignalProcessing(true);
      setIsSignalPopupOpen(true);
      setSignalResult('신호처리 중...');

      const userInfo = localStorage.getItem('userInfo');
      if (!userInfo) {
        setSignalResult('사용자 정보를 찾을 수 없습니다.');
        setLastSignalStatus('fail');
        setIsSignalProcessing(false);
        return;
      }

      const user = JSON.parse(userInfo);
      const regUid = user.userId || user.id || 'UNKNOWN';

      // 상품변경(05) 작업은 DTL_CTRT_ID 사용
      const ctrtIdForProductChange = workItem.DTL_CTRT_ID || workItem.CTRT_ID;

      const result = await checkStbServerConnection(
        regUid,
        ctrtIdForProductChange,
        workItem.id,
        'SMR03',
        installedEquipments[0]?.actualEquipment?.id || '',
        ''
      );

      if (result.O_IFSVC_RESULT && result.O_IFSVC_RESULT.startsWith('TRUE')) {
        setSignalResult(`신호처리 완료\n\n결과: ${result.O_IFSVC_RESULT || '성공'}`);
        setLastSignalStatus('success');
      } else {
        setSignalResult(`신호처리 실패\n\n${result.MESSAGE || '알 수 없는 오류'}`);
        setLastSignalStatus('fail');
      }
    } catch (error: any) {
      setSignalResult(`신호처리 실패\n\n${error.message || '알 수 없는 오류'}`);
      setLastSignalStatus('fail');
    } finally {
      setIsSignalProcessing(false);
    }
  };

  // 저장
  const handleSave = () => {
    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};

    // 상품변경(05) 작업은 DTL_CTRT_ID 사용
    const ctrtIdForProductChange = workItem.DTL_CTRT_ID || workItem.CTRT_ID;

    const equipments = installedEquipments.map(eq => ({
      id: eq.actualEquipment.id,
      type: eq.actualEquipment.type,
      model: eq.actualEquipment.model,
      serialNumber: eq.actualEquipment.serialNumber,
      itemMidCd: eq.actualEquipment.itemMidCd,
      EQT_NO: eq.actualEquipment.id,
      EQT_SERNO: eq.actualEquipment.serialNumber,
      ITEM_MID_CD: eq.actualEquipment.itemMidCd,
      EQT_CL_CD: eq.actualEquipment.eqtClCd,
      MAC_ADDRESS: eq.macAddress || eq.actualEquipment.macAddress,
      WRK_ID: workItem.id,
      CUST_ID: workItem.customer?.id || workItem.CUST_ID,
      CTRT_ID: ctrtIdForProductChange,
      WRK_CD: workItem.WRK_CD,
      SVC_CMPS_ID: eq.contractEquipment.id,
      BASIC_PROD_CMPS_ID: eq.actualEquipment.BASIC_PROD_CMPS_ID || '',
      EQT_PROD_CMPS_ID: eq.actualEquipment.EQT_PROD_CMPS_ID || eq.contractEquipment.id,
      PROD_CD: eq.actualEquipment.PROD_CD || workItem.PROD_CD,
      SVC_CD: eq.actualEquipment.SVC_CD || '',
      EQT_SALE_AMT: eq.actualEquipment.EQT_SALE_AMT || '0',
      MST_SO_ID: eq.actualEquipment.MST_SO_ID || workItem.SO_ID || user.soId,
      SO_ID: eq.actualEquipment.SO_ID || workItem.SO_ID || user.soId,
      REG_UID: user.userId || user.workerId || 'A20230019',
      OLD_LENT_YN: eq.actualEquipment.OLD_LENT_YN || 'N',
      LENT: eq.actualEquipment.LENT || '10',
      ITLLMT_PRD: eq.actualEquipment.ITLLMT_PRD || '00',
      EQT_USE_STAT_CD: eq.actualEquipment.EQT_USE_STAT_CD || '1',
      EQT_CHG_GB: eq.actualEquipment.EQT_CHG_GB || '1',
      IF_DTL_ID: eq.actualEquipment.IF_DTL_ID || '',
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
        CTRT_ID: ctrtIdForProductChange,
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
    };

    console.log('[장비관리-상품변경] 저장 데이터:', {
      설치장비: equipments.length,
      회수장비: removals.length,
      DTL_CTRT_ID: ctrtIdForProductChange,
    });

    onSave(data);
  };

  // Toggle removal equipment loss/damage status
  const handleRemovalStatusChange = (eqtNo: string, field: string, value: string) => {
    setRemovalStatus(prev => ({
      ...prev,
      [eqtNo]: {
        ...prev[eqtNo],
        [field]: value === '1' ? '0' : '1'
      }
    }));
  };

  // Filter available technician stock
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

  // Reusable removed equipment
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

  // Barcode scan
  const handleBarcodeScan = () => {
    setIsBarcodeScanning(true);
    setTimeout(() => {
      setIsBarcodeScanning(false);
      showToast?.('Barcode scan feature is under development', 'info');
    }, 500);
  };

  const availableStock = getAvailableStock();
  const reusableEquipments = getReusableRemovedEquipments();

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4 bg-gray-50 pb-4">
      {/* Customer Installed Equipment Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b border-gray-100 gap-2">
          <h4 className="text-sm sm:text-base font-bold text-gray-900">Customer Installed Equipment</h4>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {!isWorkCompleted && (
              <>
                <button
                  className={`px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-xl transition-colors whitespace-nowrap active:scale-95 ${
                    (installedEquipments.length > 0 || customerEquipmentCount > 0)
                      ? 'text-gray-400 bg-gray-100 cursor-not-allowed'
                      : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                  }`}
                  onClick={() => {
                    if (customerEquipmentCount > 0) {
                      showToast?.('Cannot change equipment info - customer has already installed equipment', 'warning');
                      return;
                    }
                    if (installedEquipments.length > 0) {
                      showToast?.('Please remove registered equipment first before changing equipment info', 'warning');
                      return;
                    }
                    setIsModelChangeModalOpen(true);
                  }}
                  disabled={installedEquipments.length > 0 || customerEquipmentCount > 0}
                >
                  Change Equipment
                </button>
                <button
                  className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap active:scale-95"
                  onClick={handleSignalProcess}
                >
                  <span>Signal Process</span>
                  <span className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${
                    lastSignalStatus === 'success' ? 'bg-green-400' :
                    lastSignalStatus === 'fail' ? 'bg-red-400' :
                    'bg-gray-400'
                  }`}></span>
                </button>
              </>
            )}
            <button
              className="px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors flex items-center gap-2 whitespace-nowrap active:scale-95"
              onClick={() => setIsIntegrationHistoryModalOpen(true)}
            >
              <History className="w-4 h-4" />
              <span>Integration History</span>
            </button>
            <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-gray-100 text-gray-700 text-xs sm:text-sm font-semibold rounded-full">{contractEquipments.length} items</span>
          </div>
        </div>

        {!isDataLoaded ? (
          <div className="py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-sm text-gray-500">Loading equipment info...</div>
            </div>
          </div>
        ) : contractEquipments.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-sm text-gray-500">No contract equipment</div>
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
                        <div className="text-sm text-green-700 font-medium">✓ Registered: {installed.actualEquipment.model}</div>
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

      {/* Register/Remove Buttons */}
      {!isWorkCompleted && (
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <button
            className={`flex flex-col items-center justify-center w-24 h-24 sm:w-32 sm:h-32 rounded-xl border-2 transition-all ${
              !selectedContract || !selectedStock || installedEquipments.some(eq => eq.actualEquipment.id === selectedStock.id)
                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-blue-500 bg-blue-50 text-blue-600 hover:bg-blue-100 cursor-pointer active:scale-95'
            }`}
            onClick={handleRegisterEquipment}
            disabled={!selectedContract || !selectedStock || installedEquipments.some(eq => eq.actualEquipment.id === selectedStock.id)}
          >
            <ArrowUp size={32} className="sm:w-10 sm:h-10" strokeWidth={2.5} />
            <span className="mt-2 text-sm sm:text-base font-bold">Register</span>
          </button>
          <button
            className={`flex flex-col items-center justify-center w-24 h-24 sm:w-32 sm:h-32 rounded-xl border-2 transition-all ${
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
            <span className="mt-2 text-sm sm:text-base font-bold">Remove</span>
          </button>
        </div>
      )}

      {/* Technician Stock Equipment Section */}
      {!isWorkCompleted && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b border-gray-100 gap-2">
            <h4 className="text-sm sm:text-base font-bold text-gray-900">
              Technician Stock Equipment
              {selectedContract && <span className="text-blue-600"> ({selectedContract.type})</span>}
            </h4>
            <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-gray-100 text-gray-700 text-xs sm:text-sm font-semibold rounded-full">
              {selectedContract ? availableStock.length : 0} items
            </span>
          </div>

          {!selectedContract ? (
            <div className="py-8 sm:py-12 text-center">
              <div className="text-xs sm:text-sm text-gray-500">Please select a customer equipment first</div>
            </div>
          ) : availableStock.length === 0 ? (
            <div className="py-8 sm:py-12 text-center">
              <div className="text-xs sm:text-sm text-gray-500">No available stock for this type</div>
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

      {/* Reusable Removed Equipment Section */}
      {selectedContract && reusableEquipments.length > 0 && !isWorkCompleted && (
        <div className="bg-white rounded-xl shadow-sm border border-green-200">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-green-100">
            <h4 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
              Reusable Removed Equipment
              {selectedContract && <span className="text-green-600"> ({selectedContract.type})</span>}
            </h4>
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-green-100 text-green-700 text-[10px] sm:text-xs font-semibold rounded-full">
              {reusableEquipments.length} items
            </span>
          </div>

          <div className="p-3 sm:p-4 space-y-2.5">
            <div className="text-sm text-gray-500 mb-2">You can reuse removed equipment for installation</div>
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
                  Reuse
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Removed Equipment Section */}
      {markedForRemoval.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b border-gray-100 gap-2">
            <h4 className="text-sm sm:text-base font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
              Removed Equipment
            </h4>
            <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-orange-100 text-orange-700 text-[10px] sm:text-xs font-semibold rounded-full">
              {markedForRemoval.length} items
            </span>
          </div>

          <div className="p-3 sm:p-4 space-y-3">
            {markedForRemoval.map(equipment => {
              const eqtNo = equipment.id;
              const status = removalStatus[eqtNo] || {};
              const isCustomerOwned = isCustomerOwnedEquipment(equipment);

              return (
                <div
                  key={equipment.id}
                  className="p-3 sm:p-4 rounded-lg border border-orange-500 bg-orange-50"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-1 flex-1">
                      <div className="text-sm font-semibold text-gray-900">{equipment.model || equipment.type}</div>
                      <div className="text-xs text-gray-600">S/N: {equipment.serialNumber}</div>
                      {equipment.macAddress && (
                        <div className="text-xs text-gray-500">MAC: {equipment.macAddress}</div>
                      )}
                    </div>
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs sm:text-sm font-bold">
                      ✓
                    </div>
                  </div>

                  {!isWorkCompleted && !readOnly && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-orange-200">
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_LOSS_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_LOSS_YN', status.EQT_LOSS_YN || '0')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">Equipment Loss</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.PART_LOSS_BRK_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'PART_LOSS_BRK_YN', status.PART_LOSS_BRK_YN || '0')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">Adapter Loss</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_BRK_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_BRK_YN', status.EQT_BRK_YN || '0')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">Remote Loss</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_CABL_LOSS_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_CABL_LOSS_YN', status.EQT_CABL_LOSS_YN || '0')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">Cable Loss</span>
                      </label>
                      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg active:bg-orange-100 whitespace-nowrap ${isCustomerOwned ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={status.EQT_CRDL_LOSS_YN === '1'}
                          onChange={() => !isCustomerOwned && handleRemovalStatusChange(eqtNo, 'EQT_CRDL_LOSS_YN', status.EQT_CRDL_LOSS_YN || '0')}
                          disabled={isCustomerOwned}
                          className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                        />
                        <span className="text-xs text-gray-700 font-medium">Cradle Loss</span>
                      </label>
                    </div>
                  )}

                  {isCustomerOwned && !isWorkCompleted && (
                    <div className="mt-2 text-xs text-orange-600 bg-orange-100 p-2 rounded">
                      Customer-owned equipment - loss processing not allowed
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
        const displayWrkCdNm = workItem.WRK_CD_NM || getWorkCodeName(workItem.WRK_CD) || workItem.workType || '-';
        const displayProdNm = workItem.PROD_NM || workItem.productName || workItem.customer?.productName || '-';
        const displayCtrtStatNm = workItem.CTRT_STAT_NM || getContractStatusName(workItem.CTRT_STAT) || '-';
        return (
          <EquipmentModelChangeModal
            isOpen={isModelChangeModalOpen}
            onClose={() => setIsModelChangeModalOpen(false)}
            prodCd={workItem.PROD_CD || ''}
            ctrtId={workItem.DTL_CTRT_ID || workItem.CTRT_ID || ''}
            ctrtStatNm={displayCtrtStatNm}
            prodGrp={workItem.PROD_GRP || ''}
            prodNm={displayProdNm}
            wrkCdNm={displayWrkCdNm}
            onSave={handleModelChange}
            showToast={showToast}
          />
        );
      })()}

      {/* Barcode Scan Floating Button */}
      {!isWorkCompleted && (
        <button
          onClick={handleBarcodeScan}
          disabled={isBarcodeScanning}
          className={`fixed bottom-24 right-4 z-40 w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
            isBarcodeScanning
              ? 'bg-blue-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          title="Barcode Scan"
        >
          <ScanBarcode className="w-7 h-7 sm:w-8 sm:h-8" />
        </button>
      )}

      {/* 연동이력 모달 */}
      <IntegrationHistoryModal
        isOpen={isIntegrationHistoryModalOpen}
        onClose={() => setIsIntegrationHistoryModalOpen(false)}
        ctrtId={workItem.DTL_CTRT_ID || workItem.CTRT_ID}
        custId={workItem.CUST_ID || workItem.customer?.id}
      />

      {/* Signal Processing Popup */}
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
              <h3 className="text-lg font-bold text-gray-900">Signal Processing</h3>
            </div>

            <div className="px-6 py-8">
              {isSignalProcessing ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-blue-500">
                    <Loader2 className="animate-spin" size={64} />
                  </div>
                  <p className="text-base font-semibold text-gray-900">Processing signal...</p>
                  <p className="text-sm text-gray-500">Please wait</p>
                </div>
              ) : lastSignalStatus === 'success' ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-green-500">
                    <CheckCircle2 size={64} />
                  </div>
                  <p className="text-base font-semibold text-gray-900">Signal processing complete!</p>
                  <div className="w-full p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">{signalResult}</pre>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4">
                  <div className="text-red-500">
                    <XCircle size={64} />
                  </div>
                  <p className="text-base font-semibold text-gray-900">Signal processing failed</p>
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
                {isSignalProcessing ? 'Processing...' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentChange;
