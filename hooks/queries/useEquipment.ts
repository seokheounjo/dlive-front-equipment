/**
 * 장비관리 React Query Hooks
 * - 순수 장비관리 기능용
 * - 기사 재고 조회
 * - 장비 상태 조회
 * - 장비 이관/회수
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTechnicianInventory,
  getEquipmentStatus,
  transferEquipment,
  getEquipmentReturnRequests,
  registerEquipmentReturn,
  checkSignal,
  getSignalHistory,
  getEquipmentOutList,
  checkEquipmentProc,
  addEquipmentQuota,
  Equipment,
  SignalCheckParams,
  SignalCheckResult
} from '../../services/equipmentApi';

// ============ Query Keys ============

export const equipmentKeys = {
  all: ['equipment'] as const,
  inventory: (wrkrId: string, soId?: string) => ['equipment', 'inventory', wrkrId, soId] as const,
  status: (serialNo: string) => ['equipment', 'status', serialNo] as const,
  returnRequests: (wrkrId: string) => ['equipment', 'returnRequests', wrkrId] as const,
  signalHistory: (serialNo: string) => ['equipment', 'signalHistory', serialNo] as const,
  outList: (wrkrId: string) => ['equipment', 'outList', wrkrId] as const,
};

// ============ Queries ============

/**
 * 기사 재고 조회
 */
export const useTechnicianInventory = (params: {
  WRKR_ID: string;
  SO_ID?: string;
  ITEM_MID_CD?: string;
}) => {
  return useQuery<Equipment[], Error>({
    queryKey: equipmentKeys.inventory(params.WRKR_ID, params.SO_ID),
    queryFn: () => getTechnicianInventory(params),
    enabled: !!params.WRKR_ID,
    staleTime: 5 * 60 * 1000, // 5분 - 재고는 자주 변경되지 않음
    gcTime: 10 * 60 * 1000,   // 10분 캐시 유지
  });
};

/**
 * 장비 상태 조회
 */
export const useEquipmentStatus = (serialNo: string) => {
  return useQuery<Equipment | null, Error>({
    queryKey: equipmentKeys.status(serialNo),
    queryFn: () => getEquipmentStatus(serialNo),
    enabled: !!serialNo,
    staleTime: 2 * 60 * 1000, // 2분
    gcTime: 5 * 60 * 1000,
  });
};

/**
 * 장비 회수 요청 목록 조회
 */
export const useEquipmentReturnRequests = (params: {
  WRKR_ID: string;
  SO_ID?: string;
  START_DT?: string;
  END_DT?: string;
}) => {
  return useQuery<any[], Error>({
    queryKey: equipmentKeys.returnRequests(params.WRKR_ID),
    queryFn: () => getEquipmentReturnRequests(params),
    enabled: !!params.WRKR_ID,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * 신호 이력 조회
 */
export const useSignalHistory = (params: {
  serialNo: string;
  startDate?: string;
  endDate?: string;
}) => {
  return useQuery<any[], Error>({
    queryKey: equipmentKeys.signalHistory(params.serialNo),
    queryFn: () => getSignalHistory(params),
    enabled: !!params.serialNo,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

/**
 * 장비 출고 목록 조회
 */
export const useEquipmentOutList = (params: {
  WRKR_ID: string;
  SO_ID?: string;
  START_DT?: string;
  END_DT?: string;
}) => {
  return useQuery<any[], Error>({
    queryKey: equipmentKeys.outList(params.WRKR_ID),
    queryFn: () => getEquipmentOutList(params),
    enabled: !!params.WRKR_ID,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// ============ Mutations ============

/**
 * 장비 이관
 */
export const useTransferEquipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: transferEquipment,
    onSuccess: (_, variables) => {
      // 이관한 기사의 재고 무효화
      queryClient.invalidateQueries({
        queryKey: equipmentKeys.inventory(variables.fromWrkrId, undefined)
      });
      // 받는 기사의 재고 무효화
      queryClient.invalidateQueries({
        queryKey: equipmentKeys.inventory(variables.toWrkrId, undefined)
      });
    },
  });
};

/**
 * 장비 회수 등록
 */
export const useRegisterEquipmentReturn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: registerEquipmentReturn,
    onSuccess: (_, variables) => {
      // 회수 요청 목록 무효화
      queryClient.invalidateQueries({
        queryKey: equipmentKeys.returnRequests(variables.WRKR_ID)
      });
      // 재고 무효화
      queryClient.invalidateQueries({
        queryKey: equipmentKeys.inventory(variables.WRKR_ID, undefined)
      });
    },
  });
};

/**
 * 신호 체크
 */
export const useCheckSignal = () => {
  const queryClient = useQueryClient();

  return useMutation<SignalCheckResult, Error, SignalCheckParams>({
    mutationFn: checkSignal,
    onSuccess: (_, variables) => {
      // 신호 이력 무효화
      queryClient.invalidateQueries({
        queryKey: equipmentKeys.signalHistory(variables.serialNo)
      });
    },
  });
};

/**
 * 장비 처리 가능 여부 확인
 */
export const useCheckEquipmentProc = () => {
  return useMutation({
    mutationFn: (serialNo: string) => checkEquipmentProc({ EQT_SERNO: serialNo }),
  });
};

/**
 * 장비 쿼터 추가
 */
export const useAddEquipmentQuota = () => {
  return useMutation({
    mutationFn: addEquipmentQuota,
  });
};
