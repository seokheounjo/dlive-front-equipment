/**
 * 설치 작업 (WRK_CD=01) 전용 장비정보 컴포넌트
 *
 * 상태 관리:
 * - Zustand (useWorkEquipmentStore): 클라이언트 상태 (설치 장비, 선택 상태, 신호처리)
 * - localStorage persist: Zustand middleware로 자동 저장
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, ArrowDown, CheckCircle2, XCircle, Loader2, ScanBarcode, History, RotateCcw } from 'lucide-react';
import { getTechnicianEquipments, updateEquipmentComposition, checkStbServerConnection } from '../../../../services/apiService';
import EquipmentModelChangeModal from './EquipmentModelChangeModal';
import IntegrationHistoryModal from '../../../modal/IntegrationHistoryModal';
import LdapQueryModal from '../../../modal/LdapQueryModal';
import { useWorkProcessStore } from '../../../../stores/workProcessStore';
import { useWorkEquipmentStore, useWorkEquipment } from '../../../../stores/workEquipmentStore';
import {
  ExtendedEquipment,
  ContractEquipment,
  InstalledEquipment,
  EquipmentData,
  EquipmentComponentProps,
  getWorkCodeName,
  getContractStatusName,
} from './shared/types';

const EquipmentInstall: React.FC<EquipmentComponentProps> = ({
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
  const workId = workItem.id;

  // 작업 완료 여부 확인
  const isWorkCompleted = readOnly || workItem.WRK_STAT_CD === '4' || workItem.status === '완료';

  // Work Process Store (필터링 데이터 저장용 - 레거시 호환)
  const { setFilteringData } = useWorkProcessStore();

  // Work Equipment Store - Actions
  const {
    initWorkState,
    setApiData,
    setDataLoaded: storeSetDataLoaded,
    addInstalledEquipment,
    removeInstalledEquipment,
    setInstalledEquipments: storeSetInstalledEquipments,
    clearInstalledEquipments,
    setSelectedContract: storeSetSelectedContract,
    setSelectedStock: storeSetSelectedStock,
    setSignalStatus,
    setSignalResult: storeSetSignalResult,
  } = useWorkEquipmentStore();

  // Work Equipment Store - State (현재 작업)
  const {
    contractEquipments,
    technicianEquipments,
    installedEquipments,
    selectedContract,
    selectedStock,
    signalStatus: lastSignalStatus,
    signalResult,
    filteringData,
    isReady: isDataLoaded,
  } = useWorkEquipment(workId);

  // 모달 상태 (로컬 UI 상태)
  const [isModelChangeModalOpen, setIsModelChangeModalOpen] = useState(false);
  const [isIntegrationHistoryModalOpen, setIsIntegrationHistoryModalOpen] = useState(false);
  const [isLdapQueryModalOpen, setIsLdapQueryModalOpen] = useState(false);
  const [isSignalPopupOpen, setIsSignalPopupOpen] = useState(false);
  const [isSignalProcessing, setIsSignalProcessing] = useState(false);
  const [isBarcodeScanning, setIsBarcodeScanning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 고객장비 수 (API output4) - 레거시 호환용
  const [customerEquipmentCount, setCustomerEquipmentCount] = useState<number>(0);

  // 초기화 및 데이터 로드
  useEffect(() => {
    // 이미 데이터가 로드된 상태면 건너뜀 (탭 이동 시 기존 데이터 유지)
    // 설치(01)에서는 installedEquipments(등록장비)와 contractEquipments(계약장비)만 체크
    if (isDataLoaded && (installedEquipments.length > 0 || contractEquipments.length > 0)) {
      console.log('[장비관리-설치] 이미 데이터 로드됨 - 기존 데이터 유지');
      return;
    }
    initWorkState(workId);
    loadEquipmentData();
  }, [workItem.id]);

  // Zustand store가 자동으로 localStorage에 persist하므로 별도 저장 로직 불필요

  const loadEquipmentData = async (forceRefresh = false) => {
    try {
      let apiResponse;

      // 설치(01) 작업은 반드시 계약장비(output2)가 있어야 함
      // preloadedApiData가 있어도 계약장비가 비어있으면 API 재호출
      const hasValidPreloadedData = preloadedApiData &&
        preloadedApiData.contractEquipments &&
        preloadedApiData.contractEquipments.length > 0;

      if (hasValidPreloadedData && !forceRefresh) {
        console.log('[장비관리-설치] Pre-loaded 데이터 사용 -', preloadedApiData.contractEquipments.length, '개 계약장비');
        apiResponse = preloadedApiData;
      } else {
        if (forceRefresh) {
          console.log('[장비관리-설치] 강제 새로고침 - API 호출');
        } else if (preloadedApiData && (!preloadedApiData.contractEquipments || preloadedApiData.contractEquipments.length === 0)) {
          console.log('[장비관리-설치] preloadedApiData 계약장비 없음 - API 재호출');
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
          WRKR_ID: workItem.WRKR_ID || user.userId || user.workerId || '',
          SO_ID: workItem.SO_ID || user.soId,
          WRK_ID: workItem.id,
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

        console.log('[장비관리-설치] 장비 데이터 로드 (API 호출)');
        console.log('[장비관리-설치] 요청:', requestPayload);

        apiResponse = await getTechnicianEquipments(requestPayload);

        // 장비변경 후 API 재호출 시 부모 컴포넌트의 preloadedData도 업데이트
        if (forceRefresh && onPreloadedDataUpdate) {
          console.log('[장비관리-설치] 부모 컴포넌트 preloadedData 업데이트');
          onPreloadedDataUpdate(apiResponse);
        }
      }

      console.log('[장비관리-설치] 응답:');
      console.log('  - 계약장비 (output2):', apiResponse.contractEquipments?.length || 0, '개');
      console.log('  - 기사재고 (output3):', apiResponse.technicianEquipments?.length || 0, '개');
      console.log('  - 고객장비 (output4):', apiResponse.customerEquipments?.length || 0, '개');

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
        ITLLMT_PRD: eq.ITLLMT_PRD,
        EQT_USE_STAT_CD: eq.EQT_USE_STAT_CD,
      }));

      // output4: 고객 설치 장비 (이미 등록된 경우)
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
            macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,
            EQT_KND: eq.EQT_KND,
            EQT_CL_CD: eq.EQT_CL_CD,
          },
          macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,
          installLocation: eq.INSTL_LCTN,
        };
      });

      console.log('[장비관리-설치] 상태 업데이트:');
      console.log('  - 계약 장비:', contracts.length, '개');
      console.log('  - 기사 재고:', techStock.length, '개');
      console.log('  - 설치 완료:', installed.length, '개');

      // Store에 API 데이터 저장
      setApiData(workId, {
        contractEquipments: contracts,
        technicianEquipments: techStock,
        filteringData: filterData,
      });

      setCustomerEquipmentCount(installed.length);

      // API에 이미 설치된 장비가 있거나 Store에 기존 데이터가 없으면 API 데이터 사용
      const currentState = useWorkEquipmentStore.getState().getWorkState(workId);
      if (installed.length > 0 && (!currentState?.installedEquipments?.length)) {
        console.log('[장비관리-설치] API에서 받은 고객 설치 장비 사용:', installed.length, '개');
        storeSetInstalledEquipments(workId, installed);
      } else if (!currentState?.installedEquipments?.length) {
        // Store에도 없고 API에도 없으면 빈 배열 (Store의 persist가 복원해줄 것)
        // 이미 persist된 데이터가 있으면 그대로 유지됨
      }
      // else: Store에 기존 데이터가 있으면 유지 (persist된 데이터 보존)

      // Use requestAnimationFrame to ensure state updates are applied before marking data as loaded
      requestAnimationFrame(() => storeSetDataLoaded(workId, true));
    } catch (error) {
      console.error('[장비관리-설치] 장비 데이터 로드 실패:', error);
      setApiData(workId, {
        contractEquipments: [],
        technicianEquipments: [],
      });
      storeSetInstalledEquipments(workId, []);
      requestAnimationFrame(() => storeSetDataLoaded(workId, true));
    }
  };

  // 계약 장비 카드 클릭
  const handleContractClick = useCallback((contract: ContractEquipment) => {
    const installed = installedEquipments.find(
      eq => eq.contractEquipment.id === contract.id
    );

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
  }, [workId, installedEquipments, selectedContract]);

  // 재고 장비 클릭
  const handleStockClick = useCallback((stock: ExtendedEquipment) => {
    if (selectedStock?.id === stock.id) {
      storeSetSelectedStock(workId, null);
    } else {
      storeSetSelectedStock(workId, stock);
    }
  }, [workId, selectedStock]);

  // 등록 버튼 - 계약 장비에 재고 할당
  const handleRegisterEquipment = useCallback(() => {
    if (!selectedContract || !selectedStock) {
      return;
    }

    // 모델명 검증: itemMidCd + model이 일치해야 함
    if (selectedContract.itemMidCd !== selectedStock.itemMidCd || selectedContract.model !== selectedStock.model) {
      showToast?.('계약장비 모델과 일치하지 않아 등록할 수 없습니다.', 'warning');
      return;
    }

    console.log('[장비관리-설치] 장비 등록:', {
      계약장비: selectedContract.type,
      재고장비: `${selectedStock.type} (S/N: ${selectedStock.serialNumber})`
    });

    const newInstalled: InstalledEquipment = {
      contractEquipment: selectedContract,
      actualEquipment: selectedStock,
      macAddress: selectedStock.macAddress || '',
      installLocation: '',
    };

    // Store action이 자동으로 기존 항목 교체 또는 추가 처리
    addInstalledEquipment(workId, newInstalled);

    // 신호처리 상태 초기화
    setSignalStatus(workId, 'idle');

    storeSetSelectedStock(workId, null);
  }, [workId, selectedContract, selectedStock]);

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

        // 장비변경 성공 시 기존 등록 장비 초기화 (새 모델로 재등록 필요)
        clearInstalledEquipments(workId);
        storeSetSelectedStock(workId, null);

        // API 재호출하여 최신 데이터 반영
        await loadEquipmentData(true);
      } else {
        throw new Error((result as any).MESSAGE || (result as any).message || '장비 모델 변경에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('[장비관리-설치] 장비 모델 변경 실패:', error);
      showToast?.(error.message || '장비 모델 변경 중 오류가 발생했습니다.', 'error', true);
      throw error;
    }
  };

  // ITEM_MID_CD별 장비 찾기
  const findEquipmentByItemMidCd = (itemMidCd: string): any | undefined => {
    return installedEquipments.find(eq => {
      const midCd = eq.actualEquipment?.itemMidCd || eq.actualEquipment?.ITEM_MID_CD || '';
      return midCd === itemMidCd;
    });
  };

  // 신호처리 우선순위에 따른 메인 장비 선택
  const getSignalEquipmentByPriority = (): { eqtNo: string; itemMidCd: string } | null => {
    const prodGrp = workItem.PROD_GRP || '';
    const voipProdCd = workItem.VOIP_PROD_CD || '';

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

    const ont = findEquipmentByItemMidCd('05');
    if (ont) {
      return { eqtNo: ont.actualEquipment?.id || ont.actualEquipment?.EQT_NO || '', itemMidCd: '05' };
    }

    const router = findEquipmentByItemMidCd('01');
    if (router) {
      return { eqtNo: router.actualEquipment?.id || router.actualEquipment?.EQT_NO || '', itemMidCd: '01' };
    }

    const modem03 = findEquipmentByItemMidCd('03');
    if (modem03) {
      return { eqtNo: modem03.actualEquipment?.id || modem03.actualEquipment?.EQT_NO || '', itemMidCd: '03' };
    }

    if (prodGrp === 'I') {
      const wireless = findEquipmentByItemMidCd('02');
      if (wireless) {
        return { eqtNo: wireless.actualEquipment?.id || wireless.actualEquipment?.EQT_NO || '', itemMidCd: '02' };
      }
    }

    const voipGw = findEquipmentByItemMidCd('08');
    if (voipGw) {
      return { eqtNo: voipGw.actualEquipment?.id || voipGw.actualEquipment?.EQT_NO || '', itemMidCd: '08' };
    }

    const stb = findEquipmentByItemMidCd('04');
    if (stb) {
      return { eqtNo: stb.actualEquipment?.id || stb.actualEquipment?.EQT_NO || '', itemMidCd: '04' };
    }

    return null;
  };

  // PROD_GRP별 신호처리 ETC 파라미터 구성
  const buildSignalEtcParams = (): { etc_1: string; etc_2: string; etc_3: string; etc_4: string } => {
    const prodGrp = workItem.PROD_GRP || '';
    const voipProdCd = workItem.VOIP_PROD_CD || '';
    const ispProdCd = workItem.ISP_PROD_CD || '';

    let etc_1 = '';
    let etc_2 = '';
    let etc_3 = '';
    let etc_4 = '';

    if (!voipProdCd) {
      const stb = findEquipmentByItemMidCd('04');
      if (stb) {
        etc_1 = stb.actualEquipment?.id || stb.actualEquipment?.EQT_NO || '';
      } else if (prodGrp === 'A') {
        etc_1 = workItem.NET_CL || '';
      }
    } else {
      const wireless = findEquipmentByItemMidCd('02');
      if (wireless) {
        etc_1 = wireless.actualEquipment?.id || wireless.actualEquipment?.EQT_NO || '';
      }
    }

    const special = findEquipmentByItemMidCd('07');
    if (special) {
      etc_2 = special.actualEquipment?.id || special.actualEquipment?.EQT_NO || '';
    }

    if (prodGrp === 'C') {
      const wireless = findEquipmentByItemMidCd('02');
      if (wireless) {
        etc_3 = wireless.actualEquipment?.id || wireless.actualEquipment?.EQT_NO || '';
      }
    }

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

  // 신호처리 메시지 ID 결정
  const getSignalMsgId = (): string => {
    const prodGrp = workItem.PROD_GRP || '';
    if (prodGrp === 'V') {
      return 'SMR60';
    }
    return 'SMR03';
  };

  const handleSignalProcess = async () => {

    // 장비 타입 판단
    const isStb = (eq: any): boolean => {
      const eqtClCd = eq.actualEquipment?.eqtClCd || eq.eqtClCd || '';
      const itemMidCd = eq.actualEquipment?.itemMidCd || eq.itemMidCd || '';
      const type = (eq.actualEquipment?.type || eq.type || '').toLowerCase();

      if (eqtClCd.startsWith('0904')) return true;
      if (itemMidCd === '05') return true;
      if (type.includes('stb') || type.includes('셋톱') || type.includes('셋탑')) return true;
      return false;
    };

    const isModem = (eq: any): boolean => {
      const eqtClCd = eq.actualEquipment?.eqtClCd || eq.eqtClCd || '';
      const itemMidCd = eq.actualEquipment?.itemMidCd || eq.itemMidCd || '';
      const type = (eq.actualEquipment?.type || eq.type || '').toLowerCase();

      if (eqtClCd.startsWith('0902')) return true;
      if (itemMidCd === '04') return true;
      if (type.includes('modem') || type.includes('모뎀') || type.includes('케이블모뎀')) return true;
      return false;
    };

    if (installedEquipments.length === 0) {
      showToast?.('임시개통을 하려면 먼저 장비를 등록해주세요. STB 또는 모뎀 장비가 필요합니다.', 'warning');
      setSignalStatus(workId, 'fail');
      return;
    }

    const prodGrp = workItem.PROD_GRP || '';
    const voipProdCd = workItem.VOIP_PROD_CD || '';

    if (prodGrp === 'V' && !voipProdCd) {
      if (!workItem.CTRT_JOIN_ID) {
        showToast?.('VoIP의 추가계약 정보가 필요합니다.', 'warning');
        setSignalStatus(workId, 'fail');
        return;
      }
    }

    const ispProdCd = workItem.ISP_PROD_CD || '';
    if (prodGrp === 'I' && ispProdCd) {
      if (!workItem.CTRT_JOIN_ID) {
        showToast?.('계약이 필요한 ISP 상품입니다. 계약의 선택이 필수입니다.', 'warning');
        setSignalStatus(workId, 'fail');
        return;
      }
    }

    const mainEquipment = getSignalEquipmentByPriority();
    const hasStb = installedEquipments.some(isStb);
    const hasModem = installedEquipments.some(isModem);

    if (!hasStb && !hasModem && !mainEquipment) {
      showToast?.('임시개통을 위해 STB 또는 모뎀 장비를 등록해주세요.', 'warning');
      setSignalStatus(workId, 'fail');
      return;
    }

    try {
      setIsSignalProcessing(true);
      setIsSignalPopupOpen(true);
      storeSetSignalResult(workId, '임시개통 중...');

      const userInfo = localStorage.getItem('userInfo');
      if (!userInfo) {
        storeSetSignalResult(workId, '사용자 정보를 찾을 수 없습니다.');
        setSignalStatus(workId, 'fail');
        setIsSignalProcessing(false);
        return;
      }

      const user = JSON.parse(userInfo);
      const regUid = user.userId || user.id || 'UNKNOWN';

      const eqtNo = mainEquipment?.eqtNo || '';
      const stbEquipment = installedEquipments.find(isStb);
      const modemEquipment = installedEquipments.find(isModem);
      const stbEqtNo = stbEquipment?.actualEquipment?.id || '';
      const modemEqtNo = modemEquipment?.actualEquipment?.id || '';

      const msgId = getSignalMsgId();

      const result = await checkStbServerConnection(
        regUid,
        workItem.CTRT_ID || '',
        workItem.id,
        msgId,
        stbEqtNo || eqtNo,
        modemEqtNo || ''
      );

      if (result.O_IFSVC_RESULT && result.O_IFSVC_RESULT.startsWith('TRUE')) {
        storeSetSignalResult(workId, `임시개통 완료\n\n결과: ${result.O_IFSVC_RESULT || '성공'}`);
        setSignalStatus(workId, 'success');
      } else {
        storeSetSignalResult(workId, `임시개통 실패\n\n${result.MESSAGE || '알 수 없는 오류'}`);
        setSignalStatus(workId, 'fail');
      }
    } catch (error: any) {
      storeSetSignalResult(workId, `임시개통 실패\n\n${error.message || '알 수 없는 오류'}`);
      setSignalStatus(workId, 'fail');
    } finally {
      setIsSignalProcessing(false);
    }
  };

  // 장비 매칭 검증
  const fn_eqt_match_chk = (): boolean => {
    if (installedEquipments.length < 1) return true;

    for (let i = 0; i < installedEquipments.length; i++) {
      const eq = installedEquipments[i].actualEquipment;
      const itemMidCd = eq.itemMidCd || eq.ITEM_MID_CD;

      if (itemMidCd === '06') continue;

      if (!eq.id && !eq.EQT_NO) {
        const eqtClNm = eq.EQT_CL_NM || eq.model || '장비';
        showToast?.(`장비번호가 ${eqtClNm}에 누락되어 있습니다.`, 'error');
        return false;
      }
    }
    return true;
  };

  // 고객 소유 장비 검증
  const fn_chk_cust_own_eqt = (): boolean => {
    const hasCustomerOwnedEquipment = installedEquipments.some(
      (eq) => eq.actualEquipment.LENT_YN === '40'
    );

    if (!hasCustomerOwnedEquipment) return true;

    for (let i = 0; i < installedEquipments.length; i++) {
      const eq = installedEquipments[i].actualEquipment;

      if (eq.LENT_YN !== '40') continue;

      const itemMidCd = eq.itemMidCd || eq.ITEM_MID_CD;

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
      } else if (itemMidCd === '02') {
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
      } else if (itemMidCd === '04') {
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
      } else if (itemMidCd === '21') {
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

      if (!eq.OWNER_TP_CD || eq.OWNER_TP_CD === '[]') {
        showToast?.('고객소유장비의 소유구분이 누락되었습니다.', 'error');
        return false;
      }
    }

    return true;
  };

  // 장비 중복 체크
  const fn_dbl_eqt_check = (): boolean => {
    if (installedEquipments.length < 1) return true;

    const hasEqtCl = (eqtCl: string): boolean => {
      return installedEquipments.some(eq => {
        const clCd = eq.actualEquipment?.eqtClCd || eq.actualEquipment?.EQT_CL_CD || '';
        return clCd === eqtCl;
      });
    };

    const hasWifi1 = hasEqtCl('090805');
    const hasWifi2 = hasEqtCl('091002');
    if ((hasWifi1 && !hasWifi2) || (!hasWifi1 && hasWifi2)) {
      showToast?.('WIFI/AP(WiFi형)이 모두 선택되어야합니다.', 'error');
      return false;
    }

    const hasDect = hasEqtCl('090804');
    const hasHandy = hasEqtCl('090901');
    if ((hasDect && !hasHandy) || (!hasDect && hasHandy)) {
      showToast?.('DECT/HANDY가 모두 선택되어야합니다.', 'error');
      return false;
    }

    const maxwProdCds = ['MAXW001', 'MAXW002', 'MAXW003'];
    const basicProdCd = workItem.BASIC_PROD_CD || workItem.PROD_CD || '';
    if (maxwProdCds.includes(basicProdCd)) {
      if (!hasEqtCl('092101')) {
        showToast?.('ISP상품_콤팩트TV제품의 경우 반드시 콤팩트TV가 필요합니다.', 'error');
        return false;
      }
    }

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

  // 부가상품 검증
  const fn_buga_prod_check = (): boolean => {
    const hasStb = installedEquipments.some(eq => {
      const itemMidCd = eq.actualEquipment?.itemMidCd || eq.actualEquipment?.ITEM_MID_CD || '';
      return itemMidCd === '04';
    });

    const additionProducts = workItem.additionProducts || [];

    for (const prod of additionProducts) {
      if (prod.ATTR_VAL_22?.includes('0904') && !hasStb) {
        showToast?.(`${prod.PROD_NM || '부가상품'}에 STB가 필요합니다. STB를 선택하거나 부가상품 체크를 해지하세요.`, 'error');
        return false;
      }
    }

    return true;
  };

  // 저장
  const handleSave = () => {
    if (!fn_eqt_match_chk()) return;
    if (!fn_chk_cust_own_eqt()) return;
    if (!fn_dbl_eqt_check()) return;
    if (!fn_buga_prod_check()) return;

    const userInfo = localStorage.getItem('userInfo');
    const user = userInfo ? JSON.parse(userInfo) : {};

    const equipments = installedEquipments.map(eq => ({
      // actualEquipment, contractEquipment 구조 유지 (CompleteInstall에서 처리)
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

    const data: EquipmentData = {
      installedEquipments: equipments,
      removedEquipments: [],
    };

    console.log('[장비관리-설치] 저장 데이터:', data);
    onSave(data);
  };

  // 기사 재고 필터링 (memoized)
  const availableStock = useMemo((): ExtendedEquipment[] => {
    const usedStockIds = new Set(
      installedEquipments.map(eq => eq.actualEquipment.id)
    );

    let available = technicianEquipments.filter(stock => !usedStockIds.has(stock.id));

    if (selectedContract) {
      available = available.filter(stock =>
        stock.itemMidCd === selectedContract.itemMidCd &&
        stock.model === selectedContract.model
      );
    }

    return available;
  }, [technicianEquipments, installedEquipments, selectedContract]);

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
      console.error('[장비관리-설치] 새로고침 실패:', error);
      showToast?.('장비 정보 새로고침에 실패했습니다.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4 bg-gray-50 pb-4 relative">
      {/* 전체 리프레시 로딩 오버레이 */}
      {isRefreshing && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center rounded-xl">
          <div className="flex flex-col items-center gap-2">
            <RotateCcw className="w-8 h-8 text-blue-500 animate-spin" />
            <span className="text-sm text-gray-600 font-medium">장비 정보 로딩 중...</span>
          </div>
        </div>
      )}

      {/* 상단: 고객 설치 장비 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
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
                className={`p-1.5 rounded-lg transition-all ${
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
          {/* 버튼 그룹 - 모바일에서 가로 스크롤 또는 그리드 */}
          <div className="grid grid-cols-4 gap-2">
            <button
              className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border-2 transition-all active:scale-95 min-h-[56px] ${
                isWorkCompleted
                  ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                  : 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:border-blue-300'
              }`}
              onClick={() => {
                if (isWorkCompleted) return;
                setIsModelChangeModalOpen(true);
              }}
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
                  isWorkCompleted || workItem.PROD_GRP === 'V'
                    ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-50'
                    : lastSignalStatus === 'success'
                      ? 'border-green-300 bg-green-100 text-green-700 hover:bg-green-200 hover:border-green-400'
                      : lastSignalStatus === 'fail'
                        ? 'border-red-500 bg-red-200 text-red-800 hover:bg-red-300 hover:border-red-600'
                        : 'border-red-300 bg-red-100 text-red-700 hover:bg-red-200 hover:border-red-400'
                }`}
                onClick={() => {
                  if (workItem.PROD_GRP === 'V') {
                    showToast?.('VOIP 설치는 임시개통을 지원하지 않습니다.', 'info');
                    return;
                  }
                  if (!isWorkCompleted && !isSignalProcessing) handleSignalProcess();
                }}
              >
                <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-xs font-semibold">임시개통</span>
              </button>
            )}
            <button
              className="flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border-2 border-orange-200 bg-orange-50 text-orange-600 hover:bg-orange-100 hover:border-orange-300 transition-all active:scale-95 min-h-[56px] opacity-50 cursor-not-allowed"
              disabled
              title="설치 작업에서는 분실처리를 사용할 수 없습니다"
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs font-semibold">분실처리</span>
            </button>
            {/* 연동이력 / LDAP조회 버튼 */}
            {isCertifyProd ? (
              <button
                className="flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border-2 border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 hover:border-purple-300 transition-all active:scale-95 min-h-[56px]"
                onClick={() => setIsLdapQueryModalOpen(true)}
              >
                <History className="w-5 h-5 mb-1" />
                <span className="text-xs font-semibold">LDAP조회</span>
              </button>
            ) : (
              <button
                className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-lg border-2 transition-all active:scale-95 min-h-[56px] ${
                  workItem.PROD_GRP === 'V'
                    ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-50'
                    : 'border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 hover:border-purple-300'
                }`}
                onClick={() => {
                  if (workItem.PROD_GRP === 'V') {
                    showToast?.('VOIP 설치는 연동이력을 지원하지 않습니다.', 'info');
                    return;
                  }
                  setIsIntegrationHistoryModalOpen(true);
                }}
              >
                <History className="w-5 h-5 mb-1" />
                <span className="text-xs font-semibold">연동이력</span>
              </button>
            )}
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
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-green-700 font-medium">✓ 등록: {installed.actualEquipment.model}</div>
                        </div>
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

      {/* 중간: 회수/등록 버튼 */}
      {!isWorkCompleted && (
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          {/* 회수 버튼 (아래 화살표) */}
          <button
            className={`flex flex-col items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-2 transition-all ${
              !selectedContract || !installedEquipments.some(eq => eq.contractEquipment.id === selectedContract?.id)
                ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                : 'border-red-500 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer active:scale-95'
            }`}
            onClick={() => {
              if (!selectedContract) return;
              removeInstalledEquipment(workId, selectedContract.id);
              setSignalStatus(workId, 'idle');
              storeSetSelectedStock(workId, null);
              showToast?.('장비 등록이 취소되었습니다.', 'info');
            }}
            disabled={!selectedContract || !installedEquipments.some(eq => eq.contractEquipment.id === selectedContract?.id)}
            title="고객에서 → 재고로 되돌리기"
          >
            <ArrowDown size={32} className="sm:w-10 sm:h-10" strokeWidth={2.5} />
          </button>

          {/* 등록 버튼 (위 화살표) */}
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
        </div>
      )}

      {/* 하단: 기사 재고 장비 */}
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
        </div>
      )}

      {/* 장비정보변경 모달 */}
      {(() => {
        const displayWrkCdNm =
          workItem.WRK_CD_NM ||
          getWorkCodeName(workItem.WRK_CD) ||
          workItem.workType ||
          '-';
        const displayProdNm =
          workItem.PROD_NM ||
          workItem.productName ||
          workItem.customer?.productName ||
          '-';
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
        installedEquipmentCount={installedEquipments.length}
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

export default EquipmentInstall;
