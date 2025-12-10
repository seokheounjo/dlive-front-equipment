/**
 * 작업 프로세스용 장비 React Query Hooks
 * - 작업 3단계(장비정보)에서 사용
 * - 작업 컨텍스트가 필요한 장비 API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEquipmentForWork,
  updateEquipmentComposition,
  saveInstallInfo,
  getEquipmentModelsForProduct,
  getContractEquipmentList,
  changeEquipmentModel,
  checkStbServerConnection,
  EquipmentQueryResponse,
  STBServerConnectionResult
} from '../../services/workEquipmentApi';

// ============ Query Keys ============

export const workEquipmentKeys = {
  all: ['workEquipment'] as const,
  forWork: (workId: string) => ['workEquipment', 'forWork', workId] as const,
  models: (prodCd: string, itemMidCd?: string) => ['workEquipment', 'models', prodCd, itemMidCd] as const,
  contractList: (ctrtId: string, prodCd: string) => ['workEquipment', 'contractList', ctrtId, prodCd] as const,
};

// ============ Queries ============

/**
 * 작업용 장비 조회 (작업 프로세스 3단계)
 */
export const useEquipmentForWork = (params: {
  WRKR_ID: string;
  SO_ID?: string;
  WORK_ID?: string;
  PROD_CD?: string;
  CUST_ID?: string;
  CRR_TSK_CL?: string;
  WRK_DTL_TCD?: string;
  CTRT_ID?: string;
  RCPT_ID?: string;
  CRR_ID?: string;
  ADDR_ORD?: string;
  WRK_CD?: string;
  WRK_STAT_CD?: string;
  WRK_DRCTN_ID?: string;
  BLD_ID?: string;
}) => {
  return useQuery<EquipmentQueryResponse, Error>({
    queryKey: workEquipmentKeys.forWork(params.WORK_ID || ''),
    queryFn: () => getEquipmentForWork(params),
    enabled: !!params.WRKR_ID && !!params.WORK_ID,
    staleTime: 2 * 60 * 1000, // 2분 - 작업 중 장비 상태는 변경될 수 있음
    gcTime: 5 * 60 * 1000,
  });
};

/**
 * 상품별 장비 모델 조회
 */
export const useEquipmentModelsForProduct = (prodCd: string, itemMidCd?: string) => {
  return useQuery<any[], Error>({
    queryKey: workEquipmentKeys.models(prodCd, itemMidCd),
    queryFn: () => getEquipmentModelsForProduct(prodCd, itemMidCd),
    enabled: !!prodCd,
    staleTime: 10 * 60 * 1000, // 10분 - 모델 정보는 자주 변경되지 않음
    gcTime: 30 * 60 * 1000,
  });
};

/**
 * 계약 장비 리스트 조회
 */
export const useContractEquipmentList = (ctrtId: string, prodCd: string) => {
  return useQuery<any[], Error>({
    queryKey: workEquipmentKeys.contractList(ctrtId, prodCd),
    queryFn: () => getContractEquipmentList(ctrtId, prodCd),
    enabled: !!ctrtId && !!prodCd,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// ============ Mutations ============

/**
 * 장비 구성 변경 (작업 완료 시)
 */
export const useUpdateEquipmentComposition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateEquipmentComposition,
    onSuccess: (_, variables) => {
      // 해당 작업의 장비 정보 무효화
      queryClient.invalidateQueries({
        queryKey: workEquipmentKeys.forWork(variables.WRK_ID)
      });
    },
  });
};

/**
 * 설치 정보 저장
 */
export const useSaveInstallInfo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveInstallInfo,
    onSuccess: (_, variables) => {
      // 해당 작업의 장비 정보 무효화
      queryClient.invalidateQueries({
        queryKey: workEquipmentKeys.forWork(variables.WRK_ID)
      });
    },
  });
};

/**
 * 장비 모델 변경
 */
export const useChangeEquipmentModel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: changeEquipmentModel,
    onSuccess: () => {
      // 모든 작업 장비 정보 무효화 (어느 작업인지 모르므로)
      queryClient.invalidateQueries({
        queryKey: workEquipmentKeys.all
      });
    },
  });
};

/**
 * STB 서버 연결 체크
 */
export const useCheckStbServerConnection = () => {
  return useMutation<STBServerConnectionResult, Error, string>({
    mutationFn: checkStbServerConnection,
  });
};
