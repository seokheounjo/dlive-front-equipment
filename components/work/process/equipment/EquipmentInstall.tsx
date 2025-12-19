import React, { useState, useEffect } from 'react';
import { ArrowUp, CheckCircle2, XCircle, Loader2, ScanBarcode, History } from 'lucide-react';
import { getTechnicianEquipments, updateEquipmentComposition, checkStbServerConnection } from '../../../../services/apiService';
import EquipmentModelChangeModal from '../../../equipment/EquipmentModelChangeModal';
import IntegrationHistoryModal from '../../../modal/IntegrationHistoryModal';
import { useWorkProcessStore } from '../../../../stores/workProcessStore';
import {
  ExtendedEquipment,
  ContractEquipment,
  InstalledEquipment,
  EquipmentData,
  EquipmentComponentProps,
  getWorkCodeName,
  getContractStatusName,
  getEquipmentStorageKey,
} from './shared/types';

const EquipmentInstall: React.FC<EquipmentComponentProps> = ({
  workItem,
  onSave,
  onBack,
  showToast,
  preloadedApiData,
  onPreloadedDataUpdate,
  readOnly = false
}) => {
  // 작업 완료 여부 확인
  const isWorkCompleted = readOnly || workItem.WRK_STAT_CD === '4' || workItem.status === '완료';

  // Work Process Store (필터링 데이터 저장용)
  const { setFilteringData } = useWorkProcessStore();

  // 계약 장비 (상단 카드)
  const [contractEquipments, setContractEquipments] = useState<ContractEquipment[]>([]);
  // 기사 재고 장비 전체
  const [technicianEquipments, setTechnicianEquipments] = useState<ExtendedEquipment[]>([]);
  // 고객 설치 장비 (할당 완료된 결과)
  const [installedEquipments, setInstalledEquipments] = useState<InstalledEquipment[]>([]);
  // API output4에서 받아온 고객장비 수
  const [customerEquipmentCount, setCustomerEquipmentCount] = useState<number>(0);

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
    setIsDataLoaded(false);
    loadEquipmentData();
  }, [workItem]);

  // localStorage 키 생성
  const getStorageKey = () => getEquipmentStorageKey(workItem.id);

  // 작업 중인 데이터 자동 저장
  useEffect(() => {
    if (!isDataLoaded) {
      return;
    }

    const storageKey = getStorageKey();

    if (installedEquipments.length > 0) {
      const draftData = {
        installedEquipments: installedEquipments,
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
  }, [installedEquipments, isDataLoaded, lastSignalStatus]);

  const loadEquipmentData = async (forceRefresh = false) => {
    try {
      let apiResponse;

      if (preloadedApiData && !forceRefresh) {
        console.log('[장비관리-설치] Pre-loaded 데이터 사용 - API 호출 건너뜀!');
        apiResponse = preloadedApiData;
      } else {
        if (forceRefresh) {
          console.log('[장비관리-설치] 강제 새로고침 - API 호출');
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
            macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,
          },
          macAddress: eq.MAC_ADDRESS || eq.MAC_ADDR,
          installLocation: eq.INSTL_LCTN,
        };
      });

      console.log('[장비관리-설치] 상태 업데이트:');
      console.log('  - 계약 장비:', contracts.length, '개');
      console.log('  - 기사 재고:', techStock.length, '개');
      console.log('  - 설치 완료:', installed.length, '개');

      setContractEquipments(contracts);
      setTechnicianEquipments(techStock);
      setCustomerEquipmentCount(installed.length);

      // API에 이미 설치된 장비가 있으면 우선 표시
      if (installed.length > 0) {
        console.log('[장비관리-설치] API에서 받은 고객 설치 장비 사용:', installed.length, '개');
        setInstalledEquipments(installed);
        // 신호처리 상태는 localStorage에서 복원
        const savedDraft = localStorage.getItem(getStorageKey());
        if (savedDraft) {
          try {
            const draftData = JSON.parse(savedDraft);
            if (draftData.lastSignalStatus) {
              setLastSignalStatus(draftData.lastSignalStatus);
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
            if (draftData.installedEquipments && draftData.installedEquipments.length > 0) {
              console.log('[장비관리-설치] localStorage에서 장비 복원:', draftData.installedEquipments.length, '개');
              setInstalledEquipments(draftData.installedEquipments);
            } else {
              setInstalledEquipments([]);
            }
            if (draftData.lastSignalStatus) {
              setLastSignalStatus(draftData.lastSignalStatus);
            }
          } catch (error) {
            console.warn('[장비관리-설치] localStorage 데이터 파싱 실패:', error);
            setInstalledEquipments([]);
          }
        } else {
          setInstalledEquipments([]);
        }
      }

      setIsDataLoaded(true);
    } catch (error) {
      console.error('[장비관리-설치] 장비 데이터 로드 실패:', error);
      setContractEquipments([]);
      setTechnicianEquipments([]);
      setInstalledEquipments([]);
      setIsDataLoaded(true);
    }
  };

  // 계약 장비 카드 클릭
  const handleContractClick = (contract: ContractEquipment) => {
    const installed = installedEquipments.find(
      eq => eq.contractEquipment.id === contract.id
    );

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

  // 재고 장비 클릭
  const handleStockClick = (stock: ExtendedEquipment) => {
    if (selectedStock?.id === stock.id) {
      setSelectedStock(null);
    } else {
      setSelectedStock(stock);
    }
  };

  // 등록 버튼 - 계약 장비에 재고 할당
  const handleRegisterEquipment = () => {
    if (!selectedContract || !selectedStock) {
      return;
    }

    console.log('[장비관리-설치] 장비 등록 시작:', {
      계약장비: selectedContract.type,
      재고장비: `${selectedStock.type} (S/N: ${selectedStock.serialNumber})`
    });

    const existingIndex = installedEquipments.findIndex(
      eq => eq.contractEquipment.id === selectedContract.id
    );

    if (existingIndex >= 0) {
      const updated = [...installedEquipments];
      updated[existingIndex] = {
        contractEquipment: selectedContract,
        actualEquipment: selectedStock,
        macAddress: selectedStock.macAddress || '',
        installLocation: '',
      };
      setInstalledEquipments(updated);
      console.log('[장비관리-설치] 기존 장비 교체 완료, 총', updated.length, '개');
    } else {
      const newInstalled: InstalledEquipment = {
        contractEquipment: selectedContract,
        actualEquipment: selectedStock,
        macAddress: selectedStock.macAddress || '',
        installLocation: '',
      };
      const updated = [...installedEquipments, newInstalled];
      setInstalledEquipments(updated);
      console.log('[장비관리-설치] 신규 장비 등록 완료, 총', updated.length, '개');
    }

    // 신호처리 상태 초기화
    setLastSignalStatus(null);

    setSelectedStock(null);
    setSelectedContract(null);
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

        // installedEquipments 업데이트
        const updatedInstalledEquipments = installedEquipments.map(installed => {
          const updatedEquipment = selectedEquipmentsFromModal.find(
            modalEq => modalEq.SVC_CMPS_ID === installed.contractEquipment.SVC_CMPS_ID
          );

          if (updatedEquipment) {
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

        // contractEquipments 업데이트
        const updatedContractEquipments = contractEquipments.map(contract => {
          const updatedEquipment = selectedEquipmentsFromModal.find(
            modalEq => modalEq.SVC_CMPS_ID === contract.SVC_CMPS_ID || modalEq.SVC_CMPS_ID === contract.id
          );

          if (updatedEquipment) {
            return {
              ...contract,
              model: updatedEquipment.EQT_CL_NM || contract.model,
              eqtClCd: updatedEquipment.EQT_CL || updatedEquipment.EQT_CL_CD || contract.eqtClCd,
            };
          }
          return contract;
        });

        setContractEquipments(updatedContractEquipments);
        setSelectedContract(null);
        setSelectedStock(null);

        // API 재호출
        await loadEquipmentData(true);
      } else {
        throw new Error((result as any).MESSAGE || (result as any).message || '장비 모델 변경에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('[장비관리-설치] 장비 모델 변경 실패:', error);
      showToast?.(error.message || '장비 모델 변경 중 오류가 발생했습니다.', 'error');
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
      showToast?.('신호처리를 하려면 먼저 장비를 등록해주세요. STB 또는 모뎀 장비가 필요합니다.', 'warning');
      setLastSignalStatus('fail');
      return;
    }

    const prodGrp = workItem.PROD_GRP || '';
    const voipProdCd = workItem.VOIP_PROD_CD || '';

    if (prodGrp === 'V' && !voipProdCd) {
      if (!workItem.CTRT_JOIN_ID) {
        showToast?.('VoIP의 추가계약 정보가 필요합니다.', 'warning');
        setLastSignalStatus('fail');
        return;
      }
    }

    const ispProdCd = workItem.ISP_PROD_CD || '';
    if (prodGrp === 'I' && ispProdCd) {
      if (!workItem.CTRT_JOIN_ID) {
        showToast?.('계약이 필요한 ISP 상품입니다. 계약의 선택이 필수입니다.', 'warning');
        setLastSignalStatus('fail');
        return;
      }
    }

    const mainEquipment = getSignalEquipmentByPriority();
    const hasStb = installedEquipments.some(isStb);
    const hasModem = installedEquipments.some(isModem);

    if (!hasStb && !hasModem && !mainEquipment) {
      showToast?.('신호처리를 위해 STB 또는 모뎀 장비를 등록해주세요.', 'warning');
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

      const eqtNo = mainEquipment?.eqtNo || '';
      const stbEquipment = installedEquipments.find(isStb);
      const modemEquipment = installedEquipments.find(isModem);
      const stbEqtNo = stbEquipment?.actualEquipment?.id || stbEquipment?.id || '';
      const modemEqtNo = modemEquipment?.actualEquipment?.id || modemEquipment?.id || '';

      const etcParams = buildSignalEtcParams();
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
      EQT_CHG_GB: '1',
      IF_DTL_ID: eq.actualEquipment.IF_DTL_ID || '',
    } as any));

    const data: EquipmentData = {
      installedEquipments: equipments,
      removedEquipments: [],
    };

    console.log('[장비관리-설치] 저장 데이터:', data);
    onSave(data);
  };

  // 기사 재고 필터링
  const getAvailableStock = (): ExtendedEquipment[] => {
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
  };

  const availableStock = getAvailableStock();

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
      {/* 상단: 고객 설치 장비 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b border-gray-100 gap-2">
          <h4 className="text-sm sm:text-base font-bold text-gray-900">고객 설치 장비</h4>
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

      {/* 중간: 등록 버튼 */}
      {!isWorkCompleted && (
        <div className="flex items-center justify-center gap-3 sm:gap-4">
          <button
            className={`flex flex-col items-center justify-center w-24 h-24 sm:w-32 sm:h-32 rounded-xl border-2 transition-all ${
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
            <span className="mt-2 text-sm sm:text-base font-bold">등록</span>
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

export default EquipmentInstall;
