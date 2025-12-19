/**
 * EquipmentMove Component
 * WRK_CD=04 (정지) 작업 전용 장비정보 컴포넌트
 * 레거시 참조: mowoDivD05.xml - fn_add_eqt() 재사용 로직
 *
 * 정지(04) 작업 특징:
 * 1. WRK_DTL_TCD=0440(일시철거복구)일 때만 "재사용" 기능 활성화
 * 2. 기본적으로 회수만 가능 (등록 버튼은 0440일 때만)
 * 3. 회수 후 체크박스만 있으면 됨 (분실/파손 처리)
 * 4. 재사용 로직: 철거된 장비를 다시 설치장비로 이동 (EQT_CHG_GB='3')
 */

import React, { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, XCircle, Loader2, RotateCcw, History } from 'lucide-react';
import { getTechnicianEquipments, checkStbServerConnection } from '../../../../services/apiService';
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

const EquipmentMove: React.FC<EquipmentComponentProps> = ({
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

  // 계약 장비 (상단 카드)
  const [contractEquipments, setContractEquipments] = useState<ContractEquipment[]>([]);
  // 고객 설치 장비 (할당 완료된 결과)
  const [installedEquipments, setInstalledEquipments] = useState<InstalledEquipment[]>([]);
  // API output4에서 받아온 고객장비 수 (서버에 이미 등록된 장비)
  const [customerEquipmentCount, setCustomerEquipmentCount] = useState<number>(0);
  // 회수 장비 목록 (고객으로부터 회수할 장비)
  const [removeEquipments, setRemoveEquipments] = useState<ExtendedEquipment[]>([]);
  // 회수 등록할 장비 목록
  const [markedForRemoval, setMarkedForRemoval] = useState<ExtendedEquipment[]>([]);

  // WRK_DTL_TCD=0440 (일시철거복구) 여부 - 재사용 기능 활성화 조건
  const isTemporaryRemovalRecovery = workItem.WRK_DTL_TCD === '0440';

  // 철거 장비 분실/파손 상태
  const [removalStatus, setRemovalStatus] = useState<RemovalStatus>({});

  // 초기 데이터 로드 완료 여부
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // 현재 선택된 계약 장비
  const [selectedContract, setSelectedContract] = useState<ContractEquipment | null>(null);

  // 선택된 재고 장비
  const [selectedStock, setSelectedStock] = useState<ExtendedEquipment | null>(null);

  // 연동이력 모달 상태
  const [isIntegrationHistoryModalOpen, setIsIntegrationHistoryModalOpen] = useState(false);

  // 신호처리 팝업 상태
  const [isSignalPopupOpen, setIsSignalPopupOpen] = useState(false);
  const [signalResult, setSignalResult] = useState<string>('');
  const [isSignalProcessing, setIsSignalProcessing] = useState(false);
  const [lastSignalStatus, setLastSignalStatus] = useState<'success' | 'fail' | null>(null);

  // 초기 데이터 로드
  useEffect(() => {
    setIsDataLoaded(false);
    loadEquipmentData();
  }, [workItem]);

  // 작업 중인 데이터 자동 저장 (localStorage)
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
        console.log('[장비관리-Suspension] Pre-loaded 데이터 사용 - API 호출 건너뜀!');
        apiResponse = preloadedApiData;
      } else {
        if (forceRefresh) {
          console.log('[장비관리-Suspension] 강제 새로고침 - API 호출');
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

        console.log('[장비관리-Suspension] API 호출:', requestPayload);
        apiResponse = await getTechnicianEquipments(requestPayload);

        if (forceRefresh && onPreloadedDataUpdate) {
          console.log('[장비관리-Suspension] 부모 컴포넌트 preloadedData 업데이트');
          onPreloadedDataUpdate(apiResponse);
        }
      }

      console.log('[장비관리-Suspension] API 응답:', {
        contractEquipments: apiResponse.contractEquipments?.length || 0,
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

      setContractEquipments(contracts);
      setRemoveEquipments(removed);
      setCustomerEquipmentCount(installed.length);


      if (installed.length > 0) {
        console.log('[장비관리-Suspension] API에서 받은 고객 설치 장비:', installed.length, '개');

        // localStorage에서 회수장비 먼저 확인
        const savedDraft = localStorage.getItem(getEquipmentStorageKey(workItem.id));
        let savedMarkedForRemoval: ExtendedEquipment[] = [];

        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            if (draftData.markedForRemoval && draftData.markedForRemoval.length > 0) {
              savedMarkedForRemoval = draftData.markedForRemoval;
              console.log('[장비관리-Suspension] localStorage에서 회수장비 복원:', savedMarkedForRemoval.length, '개');
            }
            if (draftData.lastSignalStatus) {
              setLastSignalStatus(draftData.lastSignalStatus);
            }
            if (draftData.removalStatus && Object.keys(draftData.removalStatus).length > 0) {
              setRemovalStatus(draftData.removalStatus);
            }
          } catch (error) {
            // 무시
          }
        }

        // 회수된 장비 ID 목록
        const markedForRemovalIds = new Set(savedMarkedForRemoval.map(eq => eq.id));

        // API에서 받은 장비 중 회수되지 않은 것만 설치 장비로 설정
        const filteredInstalled = installed.filter(eq => !markedForRemovalIds.has(eq.actualEquipment.id));
        console.log('[장비관리-Suspension] 회수 제외 후 설치 장비:', filteredInstalled.length, '개');

        setInstalledEquipments(filteredInstalled);
        setMarkedForRemoval(savedMarkedForRemoval);
      } else {
        // localStorage에서 복원 시도
        const savedDraft = localStorage.getItem(getEquipmentStorageKey(workItem.id));
        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            if (draftData.installedEquipments && draftData.installedEquipments.length > 0) {
              console.log('[장비관리-Suspension] localStorage에서 장비 복원:', draftData.installedEquipments.length, '개');
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
            console.warn('[장비관리-Suspension] localStorage 데이터 파싱 실패:', error);
          }
        }
      }

      setIsDataLoaded(true);
    } catch (error) {
      console.error('[장비관리-Suspension] 장비 데이터 로드 실패:', error);
      setIsDataLoaded(true);
    }
  };

  // 계약 장비 카드 클릭
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

  // 회수 장비에서 선택 (재사용용)
  const handleRemovedEquipmentClick = (equipment: ExtendedEquipment) => {
    if (selectedStock?.id === equipment.id) {
      setSelectedStock(null);
    } else {
      setSelectedStock(equipment);
    }
  };

  // 등록 버튼 (0440일 때만 UI 표시됨)
  const handleRegisterEquipment = () => {
    if (!selectedContract || !selectedStock) return;

    // 회수 목록에서 재사용
    handleSuspensionReuse(selectedStock);
  };

  // 회수 버튼
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

  // 정지(04) 작업 전용: 회수장비 → 고객설치장비 재사용
  // 레거시 참조: mowoDivD05.xml - fn_add_eqt() 함수
  const handleSuspensionReuse = (equipment: ExtendedEquipment) => {
    const removedIndex = markedForRemoval.findIndex(eq => eq.id === equipment.id);
    if (removedIndex === -1) {
      showToast?.('회수 장비 목록에서 해당 장비를 찾을 수 없습니다.', 'error');
      return;
    }

    const matchedContract = contractEquipments.find(c =>
      c.itemMidCd === equipment.itemMidCd && c.model === equipment.model
    );

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
        EQT_CHG_GB: '3', // 재사용 표시
      },
      macAddress: equipment.macAddress,
    };

    setInstalledEquipments(prev => [...prev, newInstalled]);
    setMarkedForRemoval(prev => prev.filter(eq => eq.id !== equipment.id));
    setRemovalStatus(prev => {
      const updated = { ...prev };
      delete updated[equipment.id];
      return updated;
    });
    setSelectedStock(null);
    setSelectedContract(null);

    console.log('[장비관리-Suspension] 재사용 완료:', equipment.model || equipment.type);
    showToast?.('장비를 재사용하였습니다.', 'success');
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

      const result = await checkStbServerConnection(
        regUid,
        workItem.CTRT_ID || '',
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
      CTRT_ID: workItem.CTRT_ID,
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
    };

    console.log('[장비관리-Suspension] 저장 데이터:', {
      설치장비: equipments.length,
      회수장비: removals.length,
    });

    onSave(data);
  };

  // 철거 장비 분실/파손 상태 토글
  const handleRemovalStatusChange = (eqtNo: string, field: string, value: string) => {
    setRemovalStatus(prev => ({
      ...prev,
      [eqtNo]: {
        ...prev[eqtNo],
        [field]: value === '1' ? '0' : '1'
      }
    }));
  };

  // 회수 장비 중 재사용 가능한 장비 (계약장비 선택 시 필터링)
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

  const reusableEquipments = getReusableRemovedEquipments();

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4 bg-gray-50 pb-4">
      {/* 고객 설치 장비 섹션 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b border-gray-100 gap-2">
          <h4 className="text-sm sm:text-base font-bold text-gray-900">고객 설치 장비</h4>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {!isWorkCompleted && isTemporaryRemovalRecovery && (
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
            )}
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
                      : isTemporaryRemovalRecovery
                        ? isSelected
                          ? 'border-blue-500 bg-blue-50 cursor-pointer'
                          : installed
                            ? 'border-green-200 bg-green-50 cursor-pointer'
                            : 'border-gray-200 bg-white hover:border-gray-300 cursor-pointer'
                        : installed
                          ? 'border-green-200 bg-green-50 cursor-default'
                          : 'border-gray-200 bg-white cursor-default'
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
          {isTemporaryRemovalRecovery && (
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
              <span className="mt-2 text-sm sm:text-base font-bold">등록</span>
            </button>
          )}
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
            <span className="mt-2 text-sm sm:text-base font-bold">회수</span>
          </button>
        </div>
      )}

      {/* 회수 장비 재사용 섹션 (0440일 때만) */}
      {isTemporaryRemovalRecovery && selectedContract && reusableEquipments.length > 0 && !isWorkCompleted && (
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
                className={`p-4 sm:p-5 rounded-xl border-2 transition-all cursor-pointer relative active:scale-[0.98] ${
                  selectedStock?.id === eq.id
                    ? 'border-green-500 bg-green-100'
                    : 'border-green-200 bg-green-50 hover:border-green-400'
                }`}
                onClick={() => handleRemovedEquipmentClick(eq)}
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

      {/* 회수 장비 섹션 */}
      {markedForRemoval.length > 0 && (
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
        </div>
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

export default EquipmentMove;
