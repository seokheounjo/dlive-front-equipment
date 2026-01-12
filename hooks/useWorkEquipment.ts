/**
 * 작업별 장비 API React Query Hooks
 *
 * 서버 상태 관리:
 * - useQuery: 장비 목록 조회 (캐싱, 자동 refetch)
 * - useMutation: 장비 모델 변경, 신호처리
 *
 * Zustand Store (useWorkEquipmentStore)와 연동하여
 * 서버 데이터를 자동으로 store에 동기화
 */
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import {
  getTechnicianEquipments,
  updateEquipmentComposition,
  checkStbServerConnection,
} from '../services/apiService';
import { useWorkEquipmentStore } from '../stores/workEquipmentStore';
import {
  ExtendedEquipment,
  ContractEquipment,
  InstalledEquipment,
} from '../components/work/process/equipment/shared/types';

// API 응답 타입
interface EquipmentApiResponse {
  contractEquipments?: any[];
  technicianEquipments?: any[];
  customerEquipments?: any[];
  removedEquipments?: any[];
  kpiProdGrpCd?: string;
  prodChgGb?: string;
  chgKpiProdGrpCd?: string;
  prodGrp?: string;
}

// 작업 정보 타입
interface WorkItemInfo {
  id: string;
  SO_ID?: string;
  CUST_ID?: string;
  RCPT_ID?: string;
  CTRT_ID?: string;
  CRR_ID?: string;
  ADDR_ORD?: string;
  WRK_CD?: string;
  WRK_DTL_TCD?: string;
  WRK_STAT_CD?: string;
  WRK_DRCTN_ID?: string;
  BLD_ID?: string;
  PROD_CD?: string;
  customer?: { id?: string };
  directionId?: string;
}

// Query Keys
export const equipmentQueryKeys = {
  all: ['equipment'] as const,
  work: (workId: string) => [...equipmentQueryKeys.all, 'work', workId] as const,
};

// API 응답 데이터 변환 함수
const transformContractEquipments = (data: any[]): ContractEquipment[] => {
  return (data || []).map((eq: any) => ({
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
};

const transformTechnicianEquipments = (data: any[]): ExtendedEquipment[] => {
  return (data || []).map((eq: any) => ({
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
};

const transformCustomerEquipments = (data: any[], contracts: ContractEquipment[]): InstalledEquipment[] => {
  return (data || []).map((eq: any) => {
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
};

const transformRemoveEquipments = (data: any[]): ExtendedEquipment[] => {
  return (data || []).map((eq: any) => ({
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
    EQT_LOC_TP_NM: eq.EQT_LOC_TP_NM,
    ITEM_CD: eq.ITEM_CD,
  }));
};

/**
 * 작업별 장비 목록 조회 Hook
 * - 자동으로 Zustand Store에 데이터 동기화
 * - staleTime으로 캐싱 관리
 */
export const useWorkEquipmentQuery = (
  workItem: WorkItemInfo | null,
  options?: {
    enabled?: boolean;
    crrTskCl?: string;
    onSuccess?: (data: any) => void;
  }
) => {
  const { setApiData, setDataLoaded, initWorkState, getWorkState, setInstalledEquipments } = useWorkEquipmentStore();
  const queryClient = useQueryClient();

  const workId = workItem?.id || '';

  return useQuery({
    queryKey: equipmentQueryKeys.work(workId),
    queryFn: async () => {
      if (!workItem) throw new Error('Work item is required');

      const userInfo = localStorage.getItem('userInfo');
      if (!userInfo) throw new Error('User info not found');

      const user = JSON.parse(userInfo);
      const crrTskCl = options?.crrTskCl || workItem.WRK_CD || '';
      const wrkDtlTcd = workItem.WRK_DTL_TCD || '';

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
        WRK_DTL_TCD: wrkDtlTcd,
        WRK_CD: workItem.WRK_CD || null,
        WRK_STAT_CD: workItem.WRK_STAT_CD || null,
        WRK_DRCTN_ID: workItem.WRK_DRCTN_ID || workItem.directionId || null,
        BLD_ID: workItem.BLD_ID || null,
        PROD_CD: workItem.PROD_CD || null,
      };

      console.log('[useWorkEquipmentQuery] API 호출:', requestPayload);
      const response = await getTechnicianEquipments(requestPayload);
      console.log('[useWorkEquipmentQuery] 응답 받음');

      return response as EquipmentApiResponse;
    },
    enabled: !!workItem?.id && (options?.enabled !== false),
    staleTime: 30 * 1000, // 30초 캐싱
    gcTime: 5 * 60 * 1000, // 5분 후 GC
    select: (data) => {
      // API 응답 데이터 변환
      const contracts = transformContractEquipments(data.contractEquipments || []);
      const techStock = transformTechnicianEquipments(data.technicianEquipments || []);
      const customerInstalled = transformCustomerEquipments(data.customerEquipments || [], contracts);
      const removeList = transformRemoveEquipments(data.removedEquipments || []);

      return {
        contractEquipments: contracts,
        technicianEquipments: techStock,
        customerEquipments: customerInstalled,
        removeEquipments: removeList,
        filteringData: {
          kpiProdGrpCd: data.kpiProdGrpCd,
          prodChgGb: data.prodChgGb,
          chgKpiProdGrpCd: data.chgKpiProdGrpCd,
          prodGrp: data.prodGrp,
        },
        rawResponse: data,
      };
    },
  });
};

/**
 * 장비 모델 변경 Mutation
 */
export const useEquipmentModelChangeMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workItem,
      equipments,
      selectedPromotionCount,
    }: {
      workItem: WorkItemInfo;
      equipments: any[];
      selectedPromotionCount?: string;
    }) => {
      const userInfo = localStorage.getItem('userInfo');
      if (!userInfo) throw new Error('User info not found');

      const user = JSON.parse(userInfo);

      const formattedEquipments = equipments.map((eq: any, idx: number) => {
        let itemMidCd = eq.ITEM_MID_CD || eq.ITM_MID_CD || eq.EQT || eq.EQT_CD || '';
        let modelCode = eq.EQT_CL || eq.EQT_CL_CD || '';
        let svcCmpsId = eq.SVC_CMPS_ID || eq.PROD_CMPS_ID || eq.SVC_CMPS_SEQ || eq.EQUIP_SEQ || '';

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
          PROD_GRP: String(eq.PROD_GRP || ''),
          PROD_CD: String(eq.PROD_CD || ''),
          SVC_CD: String(eq.SVC_CD || ''),
          PROM_CNT: selectedPromotionCount || '',
          SEL: '1',
          EQT_BASIC_YN: String(eq.EQT_BASIC_YN || 'N'),
          PROD_TYP: eq.PROD_TYP,
          EQUIP_SEQ: eq.EQUIP_SEQ,
        };
      });

      return updateEquipmentComposition({
        WRK_ID: workItem.id,
        RCPT_ID: workItem.RCPT_ID || '',
        CTRT_ID: workItem.CTRT_ID || '',
        PROM_CNT: selectedPromotionCount || '',
        equipments: formattedEquipments,
      });
    },
    onSuccess: (result, variables) => {
      // 성공 시 장비 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: equipmentQueryKeys.work(variables.workItem.id),
      });
    },
  });
};

/**
 * 신호처리 Mutation
 */
export const useSignalProcessMutation = () => {
  const { setSignalStatus, setSignalResult } = useWorkEquipmentStore();

  return useMutation({
    mutationFn: async ({
      workId,
      ctrtId,
      msgId,
      stbEqtNo,
      modemEqtNo,
    }: {
      workId: string;
      ctrtId: string;
      msgId: string;
      stbEqtNo: string;
      modemEqtNo: string;
    }) => {
      const userInfo = localStorage.getItem('userInfo');
      const user = userInfo ? JSON.parse(userInfo) : {};
      const regUid = user.userId || user.id || 'UNKNOWN';

      return checkStbServerConnection(
        regUid,
        ctrtId,
        workId,
        msgId,
        stbEqtNo,
        modemEqtNo
      );
    },
    onMutate: ({ workId }) => {
      setSignalStatus(workId, 'processing');
    },
    onSuccess: (result, variables) => {
      const { workId } = variables;

      if (result.O_IFSVC_RESULT && result.O_IFSVC_RESULT.startsWith('TRUE')) {
        setSignalStatus(workId, 'success');
        setSignalResult(workId, `신호처리 완료\n\n결과: ${result.O_IFSVC_RESULT || '성공'}`);
      } else {
        setSignalStatus(workId, 'fail');
        setSignalResult(workId, `신호처리 실패\n\n${result.MESSAGE || '알 수 없는 오류'}`);
      }
    },
    onError: (error: any, variables) => {
      setSignalStatus(variables.workId, 'fail');
      setSignalResult(variables.workId, `신호처리 실패\n\n${error.message || '알 수 없는 오류'}`);
    },
  });
};

/**
 * Store와 React Query 동기화 Hook
 * - API 데이터가 로드되면 자동으로 Store에 저장
 * - Store의 로컬 변경사항은 유지
 */
export const useSyncEquipmentToStore = (
  workId: string,
  queryData: ReturnType<typeof useWorkEquipmentQuery>['data'],
  isLoading: boolean
) => {
  const {
    setApiData,
    setDataLoaded,
    initWorkState,
    getWorkState,
    setInstalledEquipments,
  } = useWorkEquipmentStore();

  // 데이터 동기화
  React.useEffect(() => {
    if (!workId || isLoading || !queryData) return;

    initWorkState(workId);

    // API 데이터를 Store에 저장
    setApiData(workId, {
      contractEquipments: queryData.contractEquipments,
      technicianEquipments: queryData.technicianEquipments,
      removeEquipments: queryData.removeEquipments,
      filteringData: queryData.filteringData,
    });

    // 기존 Store에 installedEquipments가 없으면 API의 customerEquipments로 초기화
    const currentState = getWorkState(workId);
    if (!currentState?.installedEquipments?.length && queryData.customerEquipments?.length) {
      setInstalledEquipments(workId, queryData.customerEquipments);
    }

    setDataLoaded(workId, true);
  }, [workId, queryData, isLoading]);
};

// React import for useEffect
import React from 'react';
